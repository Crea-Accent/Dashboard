'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useZxing } from 'react-zxing';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import {
	ScanBarcode,
	Plus,
	Trash2,
	Minus,
	ArrowLeft,
	Loader2,
	Edit2,
	Tag,
	Check,
	Keyboard,
	Sparkles,
	BarChart3,
	FolderKanban,
	FileText,
	Search,
	Volume2,
	VolumeX,
	Repeat,
	AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/providers/ToastProvider';
import { usePermissions } from '@/providers/PermissionsProvider';
import { submitStockMutation } from './actions';
import ArticleHistoryModal from '@/components/stock/ArticleHistoryModal';

type StockItem = {
	code: string;
	quantity: number;
};

type ArticleMeta = {
	title: string;
	brand?: string;
	category?: string;
	min?: number;
	max?: number;
	currentStock?: number;
	loading?: boolean;
};

type CatalogEntry = {
	barcode: string;
	title: string;
	brand?: string;
	category?: string;
	min?: number;
	max?: number;
	quantity: number;
};

function playScanBeep(mode: 'add' | 'remove') {
	try {
		if (typeof navigator !== 'undefined' && navigator.vibrate) {
			navigator.vibrate(mode === 'add' ? 50 : [40, 30, 40]);
		}
		const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
		if (!AudioCtx) return;
		const ctx = new AudioCtx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(mode === 'add' ? 880 : 520, ctx.currentTime);
		if (mode === 'remove') {
			osc.frequency.setValueAtTime(420, ctx.currentTime + 0.07);
		}
		gain.gain.setValueAtTime(0.12, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + 0.15);
	} catch {}
}

function ScannerVideo({ onResult }: { onResult: (text: string) => void }) {
	const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

	const { ref } = useZxing({
		onDecodeResult(result: any) {
			const text = (result.rawValue || result.getText?.() || '').trim();
			if (!text) return;
			const now = Date.now();
			// 1.5s cooldown on the same barcode to prevent rapid duplicate scans in continuous mode
			if (lastScanRef.current.code === text && now - lastScanRef.current.time < 1500) {
				return;
			}
			lastScanRef.current = { code: text, time: now };
			onResult(text);
		},
	});

	return (
		<div className="overflow-hidden rounded-xl bg-black aspect-video max-h-[45vh] relative flex flex-col mt-2 border border-[var(--border)]/20">
			<video ref={ref as any} className="w-full h-full object-cover" />
			<div className="absolute inset-0 pointer-events-none flex items-center justify-center">
				<div className="w-3/5 h-1/2 border-2 border-white/50 rounded-xl relative">
					<div className="absolute inset-x-2 top-1/2 h-0.5 bg-red-500/70 animate-pulse" />
				</div>
			</div>
		</div>
	);
}

const DRAFT_STORAGE_KEY = 'stock_mutation_draft_v1';

export default function StockPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const toast = useToast();
	const { has } = usePermissions();
	const canWrite = has('stock.write');

	const [items, setItems] = useState<StockItem[]>([]);
	const [articles, setArticles] = useState<Record<string, ArticleMeta>>({});
	const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
	const [selectedProject, setSelectedProject] = useState<string>('');
	const [note, setNote] = useState<string>('');
	const [projectsList, setProjectsList] = useState<string[]>([]);
	const [draftLoaded, setDraftLoaded] = useState(false);

	// Inline quick-search & autocomplete state
	const [quickQuery, setQuickQuery] = useState('');
	const [quickDropdownOpen, setQuickDropdownOpen] = useState(false);

	const [isScanning, setIsScanning] = useState(false);
	const [continuousScan, setContinuousScan] = useState(true);
	const [soundEnabled, setSoundEnabled] = useState(true);
	const [lastScannedBanner, setLastScannedBanner] = useState<{ code: string; delta: number } | null>(null);
	const [manualCode, setManualCode] = useState('');
	const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
	const [editingItem, setEditingItem] = useState<StockItem | null>(null);
	const [customTitle, setCustomTitle] = useState('');
	const [customBrand, setCustomBrand] = useState('');
	const [customMin, setCustomMin] = useState('');
	const [customMax, setCustomMax] = useState('');
	const [isEditingMeta, setIsEditingMeta] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// History modal state
	const [historyBarcode, setHistoryBarcode] = useState<string | null>(null);

	// First time scanned article setup modal
	const [firstTimeModal, setFirstTimeModal] = useState<{
		barcode: string;
		title: string;
		brand: string;
		min: string;
		max: string;
		eanFound: boolean;
	} | null>(null);
	const [isSavingFirstTime, setIsSavingFirstTime] = useState(false);

	// Recently scanned/updated item for pulse animation & highlight
	const [recentlyChangedCode, setRecentlyChangedCode] = useState<string | null>(null);
	const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const triggerHighlight = (code: string) => {
		setRecentlyChangedCode(code);
		if (highlightTimeoutRef.current) {
			clearTimeout(highlightTimeoutRef.current);
		}
		highlightTimeoutRef.current = setTimeout(() => {
			setRecentlyChangedCode(null);
		}, 1600);
	};

	// Buffer for hardware/USB barcode scanner input on desktop
	const barcodeBufferRef = useRef<string>('');
	const lastKeyTimeRef = useRef<number>(0);

	const fetchArticleInfo = async (barcode: string) => {
		if (articles[barcode] && !articles[barcode].loading) return;

		setArticles((prev) => ({
			...prev,
			[barcode]: { ...prev[barcode], title: prev[barcode]?.title || barcode, loading: true },
		}));

		try {
			const res = await fetch(`/api/stock/articles?barcode=${encodeURIComponent(barcode)}`);
			if (res.ok) {
				const data = await res.json();
				if (data.article) {
					const hasTitle = data.article.title && data.article.title !== barcode;
					setArticles((prev) => ({
						...prev,
						[barcode]: {
							...prev[barcode],
							title: data.article.title || barcode,
							brand: data.article.brand,
							category: data.article.category,
							min: data.article.min,
							max: data.article.max,
							loading: false,
						},
					}));

					// If scanned for the very first time and user has stock.write permission, prompt setup
					if (data.isFirstTime && canWrite) {
						setFirstTimeModal({
							barcode,
							title: hasTitle ? data.article.title : '',
							brand: data.article.brand || '',
							min: data.article.min !== undefined && data.article.min !== null ? String(data.article.min) : '',
							max: data.article.max !== undefined && data.article.max !== null ? String(data.article.max) : '',
							eanFound: Boolean(hasTitle),
						});
					}
					return;
				}
			}
		} catch (err) {
			console.error('Failed to lookup barcode:', err);
		}

		setArticles((prev) => ({
			...prev,
			[barcode]: { ...prev[barcode], title: prev[barcode]?.title || barcode, loading: false },
		}));
	};

	const handleScan = (code: string, closeCameraOverride?: boolean) => {
		const cleanCode = code.trim();
		if (!cleanCode) return;

		const delta = scanMode === 'add' ? 1 : -1;
		if (soundEnabled) {
			playScanBeep(scanMode);
		}
		triggerHighlight(cleanCode);
		setLastScannedBanner({ code: cleanCode, delta });

		setItems((prev) => {
			const existingIndex = prev.findIndex((i) => i.code === cleanCode);
			if (existingIndex !== -1) {
				return prev.map((i, idx) => (idx === existingIndex ? { ...i, quantity: i.quantity + delta } : i));
			}
			return [{ code: cleanCode, quantity: delta }, ...prev];
		});

		fetchArticleInfo(cleanCode);
		if (closeCameraOverride || !continuousScan) {
			setIsScanning(false);
		}
		setManualCode('');
	};

	// Load projects list, stock catalog (for live stock & autocomplete), and restore saved draft on mount
	useEffect(() => {
		fetch('/api/projects/map')
			.then((r) => (r.ok ? r.json() : []))
			.then((data) => {
				if (Array.isArray(data)) {
					const names = Array.from(new Set(data.map((p: any) => p.name).filter(Boolean))).sort((a: any, b: any) => a.localeCompare(b));
					setProjectsList(names as string[]);
				}
			})
			.catch(() => {});

		fetch('/api/stock/overview')
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (data?.items && Array.isArray(data.items)) {
					setCatalog(data.items);
					setArticles((prev) => {
						const next = { ...prev };
						for (const entry of data.items) {
							next[entry.barcode] = {
								title: entry.title || entry.barcode,
								brand: entry.brand,
								category: entry.category,
								min: entry.min,
								max: entry.max,
								currentStock: entry.quantity,
								loading: false,
							};
						}
						return next;
					});
				}
			})
			.catch(() => {});

		try {
			const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
			if (rawDraft) {
				const parsed = JSON.parse(rawDraft);
				if (Array.isArray(parsed.items) && parsed.items.length > 0) {
					setItems(parsed.items);
					for (const item of parsed.items) {
						if (item?.code) fetchArticleInfo(item.code);
					}
				}
				if (typeof parsed.project === 'string') setSelectedProject(parsed.project);
				if (typeof parsed.note === 'string') setNote(parsed.note);
			}
		} catch {}

		// Allow URL query parameters (?project=...&mode=remove) to override project/scanMode
		const urlProject = searchParams?.get('project');
		const urlMode = searchParams?.get('mode');
		if (urlProject) setSelectedProject(urlProject);
		if (urlMode === 'remove' || urlMode === 'add') setScanMode(urlMode);

		setDraftLoaded(true);
	}, []);

	// Persist draft to localStorage so technicians don't lose scanned items on refresh
	useEffect(() => {
		if (!draftLoaded) return;
		try {
			if (items.length === 0 && !selectedProject && !note) {
				localStorage.removeItem(DRAFT_STORAGE_KEY);
			} else {
				localStorage.setItem(
					DRAFT_STORAGE_KEY,
					JSON.stringify({
						items,
						project: selectedProject,
						note,
					})
				);
			}
		} catch {}
	}, [items, selectedProject, note, draftLoaded]);

	// Global keyboard barcode scanner support for desktop
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if typing in an input or textarea
			const target = e.target as HTMLElement;
			if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable) {
				return;
			}

			const now = Date.now();
			// Handheld barcode scanners typically type characters rapidly (< 50ms apart)
			if (now - lastKeyTimeRef.current > 150) {
				barcodeBufferRef.current = '';
			}
			lastKeyTimeRef.current = now;

			if (e.key === 'Enter') {
				if (barcodeBufferRef.current.length >= 3) {
					handleScan(barcodeBufferRef.current);
					barcodeBufferRef.current = '';
				}
			} else if (e.key.length === 1) {
				barcodeBufferRef.current += e.key;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [scanMode, soundEnabled, continuousScan]);

	const quickSuggestions = catalog
		.filter((c) => {
			const q = quickQuery.toLowerCase().trim();
			if (!q) return false;
			return c.barcode.toLowerCase().includes(q) || (c.title && c.title.toLowerCase().includes(q)) || (c.brand && c.brand.toLowerCase().includes(q));
		})
		.slice(0, 6);

	const clearDraft = () => {
		setItems([]);
		setSelectedProject('');
		setNote('');
		try {
			localStorage.removeItem(DRAFT_STORAGE_KEY);
		} catch {}
	};

	const handleSubmit = async () => {
		if (items.length === 0) return;
		setIsSubmitting(true);
		const count = items.length;
		const metaPayload = {
			project: selectedProject.trim() || undefined,
			note: note.trim() || undefined,
		};

		try {
			// Call the standard REST API route to avoid Server Action reverse-proxy / CSRF issues
			const res = await fetch('/api/stock/mutate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items, ...metaPayload }),
			});

			const data = await res.json().catch(() => ({}));

			if (res.ok && data.success) {
				clearDraft();
				toast('success', `Stock mutation saved successfully (${count} ${count === 1 ? 'item' : 'items'})!`);
				router.push('/dashboard/stock');
				return;
			}

			// If REST endpoint failed, attempt fallback to server action
			try {
				const fallback = await submitStockMutation(items, metaPayload);
				if (fallback.success) {
					clearDraft();
					toast('success', `Stock mutation saved successfully (${count} ${count === 1 ? 'item' : 'items'})!`);
					router.push('/dashboard/stock');
					return;
				}
				toast('error', 'Failed to save: ' + (fallback.error || data.error || 'Server error'));
			} catch (fallbackErr: any) {
				toast('error', 'Failed to save: ' + (data.error || fallbackErr.message || 'Unknown error'));
			}
		} catch (error: any) {
			console.error('Submit stock mutation error:', error);
			try {
				const fallback = await submitStockMutation(items, metaPayload);
				if (fallback.success) {
					clearDraft();
					toast('success', `Stock mutation saved successfully (${count} ${count === 1 ? 'item' : 'items'})!`);
					router.push('/dashboard/stock');
					return;
				}
				toast('error', 'Error saving mutation: ' + (fallback.error || error.message));
			} catch (fallbackErr: any) {
				toast('error', 'Error saving mutation: ' + (error.message || 'Network error'));
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const updateQuantityExact = (code: string, newQuantity: number) => {
		triggerHighlight(code);
		setItems((prev) => prev.map((i) => (i.code === code ? { ...i, quantity: newQuantity } : i)));
	};

	const removeItem = (code: string) => {
		setItems((prev) => prev.filter((i) => i.code !== code));
	};

	const openEditModal = (item: StockItem) => {
		setEditingItem({ ...item });
		const meta = articles[item.code];
		setCustomTitle(meta?.title && meta.title !== item.code ? meta.title : '');
		setCustomBrand(meta?.brand || '');
		setCustomMin(meta?.min !== undefined && meta?.min !== null ? String(meta.min) : '');
		setCustomMax(meta?.max !== undefined && meta?.max !== null ? String(meta.max) : '');
		setIsEditingMeta(false);
	};

	const handleSaveCustomMeta = async () => {
		if (!editingItem) return;
		const barcode = editingItem.code;
		const newTitle = customTitle.trim() || barcode;
		const newBrand = customBrand.trim() || undefined;
		const minVal = customMin.trim() !== '' && !isNaN(parseInt(customMin, 10)) ? parseInt(customMin, 10) : undefined;
		const maxVal = customMax.trim() !== '' && !isNaN(parseInt(customMax, 10)) ? parseInt(customMax, 10) : undefined;

		setArticles((prev) => ({
			...prev,
			[barcode]: {
				...prev[barcode],
				title: newTitle,
				brand: newBrand,
				min: minVal,
				max: maxVal,
				loading: false,
			},
		}));

		try {
			await fetch('/api/stock/articles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					barcode,
					title: newTitle,
					brand: newBrand,
					min: minVal,
					max: maxVal,
				}),
			});
		} catch (err) {
			console.error('Failed to save custom article info:', err);
		}

		setIsEditingMeta(false);
	};

	const handleSaveFirstTime = async () => {
		if (!firstTimeModal) return;
		setIsSavingFirstTime(true);
		const barcode = firstTimeModal.barcode;
		const titleVal = firstTimeModal.title.trim() || barcode;
		const brandVal = firstTimeModal.brand.trim() || undefined;
		const minVal = firstTimeModal.min.trim() !== '' && !isNaN(parseInt(firstTimeModal.min, 10)) ? parseInt(firstTimeModal.min, 10) : undefined;
		const maxVal = firstTimeModal.max.trim() !== '' && !isNaN(parseInt(firstTimeModal.max, 10)) ? parseInt(firstTimeModal.max, 10) : undefined;

		setArticles((prev) => ({
			...prev,
			[barcode]: {
				...prev[barcode],
				title: titleVal,
				brand: brandVal,
				min: minVal,
				max: maxVal,
				loading: false,
			},
		}));

		try {
			await fetch('/api/stock/articles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					barcode,
					title: titleVal,
					brand: brandVal,
					min: minVal,
					max: maxVal,
				}),
			});
		} catch (err) {
			console.error('Failed to save first time article setup:', err);
		} finally {
			setIsSavingFirstTime(false);
			setFirstTimeModal(null);
		}
	};

	return (
		<div className="flex flex-col h-[calc(100dvh-var(--header-height,64px))] md:h-[calc(100dvh-5.5rem)] -mt-4 md:-mt-2 overflow-hidden">
			{/* Main Scrollable Content */}
			<div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-2 pb-28 md:pb-24">
				<div className="max-w-3xl mx-auto space-y-6">
					{/* Header Navigation */}
					<div className="flex items-center justify-between gap-3">
						<Link href="/dashboard/stock" className="p-2.5 sm:p-3 bg-[var(--foreground)] hover:bg-[var(--border)]/20 rounded-full transition-colors shadow-sm text-[var(--text)] shrink-0">
							<ArrowLeft size={20} className="sm:w-6 sm:h-6" />
						</Link>

						<div className="flex items-center gap-2">
							{items.length > 0 && (
								<Button variant="secondary" onClick={clearDraft} disabled={isSubmitting} icon={<Trash2 size={16} />} title="Clear scanned items">
									<span className="hidden sm:inline">Clear</span>
								</Button>
							)}

							{/* Submit / Book Button */}
							<Button
								onClick={handleSubmit}
								disabled={items.length === 0 || isSubmitting}
								loading={isSubmitting}
								icon={<Check size={18} />}
								className="bg-[var(--accent)] text-white hover:brightness-90 disabled:opacity-50"
							>
								<span className="hidden sm:inline">Book ({items.length})</span>
								<span className="sm:hidden">Book ({items.length})</span>
							</Button>
						</div>
					</div>

					<PageHeader icon={<ScanBarcode size={24} />} title="Stock Inventory" description="Scan or enter barcodes to add or remove articles" />

					{/* Optional Project & Note Assignment Bar */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[var(--foreground)] rounded-2xl border border-[var(--border)]/15">
						<div>
							<label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] mb-1.5">
								<FolderKanban size={13} className="text-[var(--accent)]" />
								Link to Project <span className="font-normal opacity-75">(optional)</span>
							</label>
							<select
								value={selectedProject}
								onChange={(e) => setSelectedProject(e.target.value)}
								className="w-full h-10 px-3 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
							>
								<option value="">General Stock (No project)</option>
								{projectsList.map((proj) => (
									<option key={proj} value={proj}>
										{proj}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] mb-1.5">
								<FileText size={13} className="text-[var(--accent)]" />
								Note / Reference <span className="font-normal opacity-75">(optional)</span>
							</label>
							<input
								type="text"
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder="e.g. Cabinet build, supplier delivery..."
								className="w-full h-10 px-3 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>
					</div>

					{/* Inline Smart Search & Barcode Entry Bar */}
					<div className="relative">
						<div className="flex flex-col sm:flex-row gap-2">
							{/* Mode Toggle Pill */}
							<div className="flex p-1 bg-[var(--foreground)] rounded-xl border border-[var(--border)]/15 shrink-0">
								<button
									type="button"
									onClick={() => setScanMode('add')}
									className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
										scanMode === 'add' ? 'bg-[var(--accent)] text-white shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
									}`}
								>
									<Plus size={14} />
									Stock In (+1)
								</button>
								<button
									type="button"
									onClick={() => setScanMode('remove')}
									className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
										scanMode === 'remove' ? 'bg-red-500 text-white shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
									}`}
								>
									<Minus size={14} />
									Stock Out (-1)
								</button>
							</div>

							{/* Search / Barcode Input */}
							<form
								onSubmit={(e) => {
									e.preventDefault();
									const q = quickQuery.trim();
									if (!q) return;
									if (quickSuggestions.length === 1) {
										handleScan(quickSuggestions[0].barcode, true);
									} else {
										handleScan(q, true);
									}
									setQuickQuery('');
									setQuickDropdownOpen(false);
								}}
								className="relative flex-1 flex gap-2"
							>
								<div className="relative flex-1">
									<Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
									<input
										type="text"
										value={quickQuery}
										onFocus={() => setQuickDropdownOpen(true)}
										onBlur={() => setTimeout(() => setQuickDropdownOpen(false), 180)}
										onChange={(e) => {
											setQuickQuery(e.target.value);
											setQuickDropdownOpen(true);
										}}
										placeholder="Search article by name, brand, or type barcode..."
										className="w-full h-11 pl-10 pr-4 rounded-xl border border-[var(--border)]/15 bg-[var(--foreground)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
									/>
								</div>
								<Button type="submit" disabled={!quickQuery.trim()} variant="secondary" className="shrink-0">
									{scanMode === 'add' ? 'Add +1' : 'Take -1'}
								</Button>
							</form>
						</div>

						{/* Autocomplete Suggestions Dropdown */}
						{quickDropdownOpen && quickSuggestions.length > 0 && (
							<div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[var(--foreground)] border border-[var(--border)]/20 rounded-2xl shadow-2xl overflow-hidden divide-y divide-[var(--border)]/10">
								{quickSuggestions.map((entry) => (
									<button
										key={entry.barcode}
										type="button"
										onMouseDown={(e) => {
											e.preventDefault();
											handleScan(entry.barcode, true);
											setQuickQuery('');
											setQuickDropdownOpen(false);
										}}
										className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--background)] text-left transition-colors cursor-pointer"
									>
										<div className="min-w-0">
											<p className="text-sm font-semibold text-[var(--text)] truncate">{entry.title !== entry.barcode ? entry.title : entry.barcode}</p>
											<div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
												{entry.brand && <span className="text-[var(--accent)] font-medium">{entry.brand}</span>}
												<span className="font-mono">{entry.barcode}</span>
											</div>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<span className="text-xs px-2 py-0.5 rounded-lg bg-[var(--background)] border border-[var(--border)]/15 font-mono text-[var(--text-muted)]">
												Stock: <strong className="text-[var(--text)]">{entry.quantity}</strong>
											</span>
											<span className={`text-xs font-bold px-2.5 py-1 rounded-lg text-white ${scanMode === 'add' ? 'bg-[var(--accent)]' : 'bg-red-500'}`}>
												{scanMode === 'add' ? '+1' : '-1'}
											</span>
										</div>
									</button>
								))}
							</div>
						)}
					</div>

					{/* Scanned Items List */}
					{items.length === 0 ? (
						<div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)]/10 rounded-2xl bg-[var(--background)] p-8 sm:p-12 min-h-[260px] sm:min-h-[320px] text-center space-y-3">
							<div className="h-12 w-12 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--accent)] shadow-sm">
								<ScanBarcode size={24} />
							</div>
							<p className="font-semibold text-base text-[var(--text)]">No items scanned yet</p>
							<p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm">
								Search an article by name above, scan with your camera below, or scan directly with a USB barcode scanner.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							<AnimatePresence initial={false} mode="popLayout">
								{items.map((item) => {
									const isPositive = item.quantity > 0;
									const isNegative = item.quantity < 0;
									const meta = articles[item.code];
									const hasHumanTitle = Boolean(meta?.title && meta.title !== item.code);
									const isRecentlyChanged = recentlyChangedCode === item.code;
									const hasCurrentStock = meta?.currentStock !== undefined && meta?.currentStock !== null;
									const resultingStock = hasCurrentStock ? (meta.currentStock || 0) + item.quantity : null;
									const dropsBelowMin = resultingStock !== null && meta?.min !== undefined && meta?.min !== null && resultingStock < meta.min;

									return (
										<motion.div
											layout
											key={item.code}
											initial={{ opacity: 0, scale: 0.88, y: -20 }}
											animate={{
												opacity: 1,
												scale: isRecentlyChanged ? [1, 1.025, 1] : 1,
												y: 0,
											}}
											exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
											transition={{
												type: 'spring',
												stiffness: 420,
												damping: 28,
												layout: { duration: 0.25 },
											}}
											onClick={() => openEditModal(item)}
											className={`relative overflow-hidden flex items-center justify-between p-3.5 sm:p-4 rounded-2xl shadow-sm cursor-pointer transition-all gap-3 ${
												isPositive
													? 'bg-[var(--accent)] text-white border border-[var(--accent)]'
													: isNegative
														? 'bg-red-500 text-white border border-red-500'
														: 'bg-[var(--foreground)] text-[var(--text)] border border-[var(--border)]/10'
											} ${isRecentlyChanged ? 'ring-4 ring-white/90 shadow-xl shadow-white/25 brightness-105' : 'hover:scale-[1.008] active:scale-[0.99]'}`}
										>
											{/* Highlight Flash Effect */}
											{isRecentlyChanged && (
												<motion.div
													initial={{ opacity: 0.45 }}
													animate={{ opacity: 0 }}
													transition={{ duration: 1.2, ease: 'easeOut' }}
													className="absolute inset-0 bg-white pointer-events-none rounded-2xl"
												/>
											)}

											<div className="flex-1 min-w-0 z-10">
												{hasHumanTitle ? (
													<div>
														<div className="flex items-center gap-2">
															<p className="font-semibold text-sm sm:text-base truncate leading-snug">{meta?.title}</p>
															{isRecentlyChanged && (
																<motion.span
																	initial={{ scale: 0, opacity: 0 }}
																	animate={{ scale: 1, opacity: 1 }}
																	exit={{ scale: 0, opacity: 0 }}
																	className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white shrink-0 shadow-sm"
																>
																	<Sparkles size={11} /> Updated
																</motion.span>
															)}
														</div>
														<div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
															{meta?.brand && <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-black/15 font-medium">{meta.brand}</span>}
															<span className="font-mono text-[11px] sm:text-xs opacity-75">{item.code}</span>
															{hasCurrentStock && (
																<span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-black/20 font-mono">
																	Stock: {meta?.currentStock} → <strong>{resultingStock}</strong>
																</span>
															)}
															{dropsBelowMin && (
																<span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-300 text-amber-950 font-bold">
																	<AlertTriangle size={11} /> Below Min ({meta?.min})
																</span>
															)}
														</div>
													</div>
												) : (
													<div>
														<div className="flex items-center gap-2">
															<p className="font-mono font-semibold truncate text-base sm:text-lg">{item.code}</p>
															{isRecentlyChanged && (
																<motion.span
																	initial={{ scale: 0, opacity: 0 }}
																	animate={{ scale: 1, opacity: 1 }}
																	exit={{ scale: 0, opacity: 0 }}
																	className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white shrink-0 shadow-sm"
																>
																	<Sparkles size={11} /> Updated
																</motion.span>
															)}
														</div>
														<div className="flex flex-wrap items-center gap-2 mt-0.5">
															{meta?.loading && (
																<span className="text-xs opacity-75 inline-flex items-center gap-1">
																	<Loader2 size={12} className="animate-spin" /> Searching ean-db...
																</span>
															)}
															{hasCurrentStock && (
																<span className="text-[11px] px-2 py-0.5 rounded-full bg-black/20 font-mono">
																	Stock: {meta?.currentStock} → <strong>{resultingStock}</strong>
																</span>
															)}
														</div>
													</div>
												)}
											</div>

											<div className="flex items-center gap-1.5 sm:gap-2 shrink-0 z-10">
												<button
													onClick={(e) => {
														e.stopPropagation();
														updateQuantityExact(item.code, item.quantity - 1);
													}}
													className="p-1.5 sm:p-2 rounded-xl transition-colors hover:bg-black/10 active:bg-black/20"
													title="-1"
												>
													<Minus size={20} className="sm:w-5 sm:h-5" />
												</button>

												<motion.span
													key={item.quantity}
													initial={{ scale: 1.45, y: -2 }}
													animate={{ scale: 1, y: 0 }}
													transition={{ type: 'spring', stiffness: 500, damping: 20 }}
													className="font-bold text-xl sm:text-2xl min-w-[2.5rem] sm:min-w-[3rem] text-center inline-block"
												>
													{isPositive ? `+${item.quantity}` : item.quantity}
												</motion.span>

												<button
													onClick={(e) => {
														e.stopPropagation();
														updateQuantityExact(item.code, item.quantity + 1);
													}}
													className="p-1.5 sm:p-2 rounded-xl transition-colors hover:bg-black/10 active:bg-black/20"
													title="+1"
												>
													<Plus size={20} className="sm:w-5 sm:h-5" />
												</button>
											</div>
										</motion.div>
									);
								})}
							</AnimatePresence>
						</div>
					)}
				</div>
			</div>

			{/* Responsive Bottom Action Bar */}
			{/* Mobile Dock (Sticky flush bottom with safe-area support) */}
			<div className="sm:hidden flex-none bg-[var(--background)]/95 backdrop-blur-md border-t border-[var(--border)]/15 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl z-40">
				<div className="flex gap-2.5">
					<button
						onClick={() => {
							setScanMode('add');
							setIsScanning(true);
						}}
						className="flex-1 h-12 bg-[var(--accent)] text-white rounded-xl flex items-center justify-center gap-2 font-semibold text-sm active:scale-95 transition-all shadow-sm"
					>
						<Plus size={20} />
						Scan In (+1)
					</button>

					<button
						onClick={() => {
							setScanMode('remove');
							setIsScanning(true);
						}}
						className="flex-1 h-12 bg-red-500 text-white rounded-xl flex items-center justify-center gap-2 font-semibold text-sm active:scale-95 transition-all shadow-sm"
					>
						<Minus size={20} />
						Scan Out (-1)
					</button>
				</div>
			</div>

			{/* Desktop Floating Action Dock */}
			<div className="hidden sm:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 items-center gap-3 p-2 rounded-2xl bg-[var(--foreground)] border border-[var(--border)]/20 shadow-2xl backdrop-blur-md">
				<Button
					onClick={() => {
						setScanMode('add');
						setIsScanning(true);
					}}
					icon={<Plus size={18} />}
					className="bg-[var(--accent)] text-white hover:brightness-90"
				>
					Scan In (+1)
				</Button>

				<Button
					onClick={() => {
						setScanMode('remove');
						setIsScanning(true);
					}}
					icon={<Minus size={18} />}
					variant="danger"
				>
					Scan Out (-1)
				</Button>

				<div className="w-px h-6 bg-[var(--border)]/20 mx-1" />

				<Button
					variant="ghost"
					size="sm"
					icon={<Keyboard size={16} />}
					onClick={() => {
						setScanMode('add');
						setIsScanning(true);
					}}
					title="Manually enter barcode"
				>
					Camera / Manual
				</Button>
			</div>

			{/* Scanner Modal */}
			<Modal open={isScanning} onClose={() => setIsScanning(false)} title={scanMode === 'add' ? 'Scan item in (+1)' : 'Scan item out (-1)'} size="md">
				<div className="space-y-3.5">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={() => setScanMode('add')}
								className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
									scanMode === 'add' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--background)] text-[var(--text-muted)]'
								}`}
							>
								+1 Stock In
							</button>
							<button
								type="button"
								onClick={() => setScanMode('remove')}
								className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
									scanMode === 'remove' ? 'bg-red-500 text-white' : 'bg-[var(--background)] text-[var(--text-muted)]'
								}`}
							>
								-1 Stock Out
							</button>
						</div>

						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={() => setContinuousScan(!continuousScan)}
								className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border transition-colors ${
									continuousScan
										? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
										: 'bg-[var(--background)] text-[var(--text-muted)] border-[var(--border)]/15'
								}`}
								title="Keep camera open to scan multiple items in a row"
							>
								<Repeat size={12} />
								{continuousScan ? 'Continuous: ON' : 'Single Scan'}
							</button>

							<button
								type="button"
								onClick={() => setSoundEnabled(!soundEnabled)}
								className="p-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]/15 text-[var(--text-muted)] hover:text-[var(--text)]"
								title={soundEnabled ? 'Sound & vibration enabled' : 'Muted'}
							>
								{soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
							</button>
						</div>
					</div>

					{isScanning && <ScannerVideo onResult={(code) => handleScan(code)} />}

					{/* Live Scanned Feedback Pill inside Continuous Camera Modal */}
					{lastScannedBanner && (
						<div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
							<span className="font-medium text-[var(--text)] truncate">
								Last scanned: <strong>{articles[lastScannedBanner.code]?.title || lastScannedBanner.code}</strong>
							</span>
							<span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
								{lastScannedBanner.delta > 0 ? `+${lastScannedBanner.delta}` : lastScannedBanner.delta} (Total:{' '}
								{items.find((i) => i.code === lastScannedBanner.code)?.quantity ?? lastScannedBanner.delta})
							</span>
						</div>
					)}

					<div className="pt-2 border-t border-[var(--border)]/10 space-y-2">
						<p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Manual barcode entry</p>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (manualCode.trim()) handleScan(manualCode.trim());
							}}
							className="flex gap-2"
						>
							<input
								type="text"
								placeholder="Enter barcode..."
								value={manualCode}
								onChange={(e) => setManualCode(e.target.value)}
								autoFocus
								className="flex-1 h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
							/>
							<Button type="submit" disabled={!manualCode.trim()}>
								Add
							</Button>
						</form>
					</div>
				</div>
			</Modal>

			{/* Edit Item Modal */}
			<Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Article" size="sm">
				{editingItem && (
					<div className="space-y-5 pt-1">
						{/* Article Meta Info */}
						<div className="p-3.5 bg-[var(--background)] rounded-xl border border-[var(--border)]/10 space-y-2">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<p className="text-xs text-[var(--text-muted)] mb-0.5">Article Name</p>
									<p className="font-semibold text-sm text-[var(--text)] leading-snug">{articles[editingItem.code]?.title || editingItem.code}</p>
									{articles[editingItem.code]?.brand && (
										<p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
											<Tag size={12} /> {articles[editingItem.code]?.brand}
										</p>
									)}
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<button
										onClick={() => setHistoryBarcode(editingItem.code)}
										className="p-1.5 rounded-lg hover:bg-[var(--border)]/15 text-[var(--text-muted)] hover:text-emerald-500 transition-colors"
										title="View in & out history graph"
									>
										<BarChart3 size={16} />
									</button>
									{canWrite && (
										<button
											onClick={() => setIsEditingMeta(!isEditingMeta)}
											className="p-1.5 rounded-lg hover:bg-[var(--border)]/15 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
											title="Edit name & settings"
										>
											<Edit2 size={16} />
										</button>
									)}
								</div>
							</div>

							<div className="pt-2 border-t border-[var(--border)]/10">
								<p className="text-xs text-[var(--text-muted)] mb-0.5">Barcode</p>
								<p className="font-mono text-xs font-medium text-[var(--text)]">{editingItem.code}</p>
							</div>
						</div>

						{/* Custom Name & Limits Edit Section */}
						{isEditingMeta && (
							<div className="p-3.5 bg-[var(--foreground)] rounded-xl border border-[var(--border)]/15 space-y-3 animate-in fade-in duration-200">
								<p className="text-xs font-semibold text-[var(--text)]">Edit article details & limits</p>
								<div>
									<label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
									<input
										type="text"
										value={customTitle}
										onChange={(e) => setCustomTitle(e.target.value)}
										placeholder="Article name..."
										className="w-full h-10 px-3 rounded-lg border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
									/>
								</div>
								<div>
									<label className="block text-xs text-[var(--text-muted)] mb-1">Brand (optional)</label>
									<input
										type="text"
										value={customBrand}
										onChange={(e) => setCustomBrand(e.target.value)}
										placeholder="Brand..."
										className="w-full h-10 px-3 rounded-lg border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
									/>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div>
										<label className="block text-xs text-[var(--text-muted)] mb-1">Min. Stock</label>
										<input
											type="number"
											min="0"
											value={customMin}
											onChange={(e) => setCustomMin(e.target.value)}
											placeholder="e.g. 5"
											className="w-full h-10 px-3 rounded-lg border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
										/>
									</div>
									<div>
										<label className="block text-xs text-[var(--text-muted)] mb-1">Max. Stock</label>
										<input
											type="number"
											min="0"
											value={customMax}
											onChange={(e) => setCustomMax(e.target.value)}
											placeholder="e.g. 20"
											className="w-full h-10 px-3 rounded-lg border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
										/>
									</div>
								</div>
								<div className="flex justify-end gap-2 pt-1">
									<Button size="sm" variant="ghost" onClick={() => setIsEditingMeta(false)}>
										Cancel
									</Button>
									<Button size="sm" onClick={handleSaveCustomMeta}>
										Save
									</Button>
								</div>
							</div>
						)}

						{/* Quantity Input */}
						<div>
							<label className="block text-sm font-medium text-[var(--text)] mb-2">Quantity</label>
							<input
								type="number"
								value={editingItem.quantity}
								onChange={(e) => {
									const val = parseInt(e.target.value);
									setEditingItem({ ...editingItem, quantity: isNaN(val) ? (e.target.value as any) : val });
								}}
								className="w-full h-12 px-4 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-lg font-bold text-center focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>

						<div className="flex gap-2.5">
							<Button
								variant="danger-ghost"
								className="flex-1"
								onClick={() => {
									removeItem(editingItem.code);
									setEditingItem(null);
								}}
							>
								<Trash2 size={16} className="mr-1.5" />
								Delete
							</Button>
							<Button
								className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)] hover:brightness-90 text-white border-none"
								onClick={() => {
									updateQuantityExact(editingItem.code, editingItem.quantity);
									setEditingItem(null);
								}}
							>
								Save
							</Button>
						</div>
					</div>
				)}
			</Modal>

			{/* First Time Scanned Article Setup Modal */}
			<Modal open={!!firstTimeModal} onClose={() => setFirstTimeModal(null)} title="Configure New Article" size="md">
				{firstTimeModal && (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSaveFirstTime();
						}}
						className="space-y-4 pt-1"
					>
						{/* Context banner */}
						<div className="p-3.5 bg-[var(--accent)]/10 rounded-xl border border-[var(--accent)]/20 text-xs text-[var(--text)] flex items-start gap-2.5">
							<Sparkles size={18} className="text-[var(--accent)] shrink-0 mt-0.5" />
							<div>
								<p className="font-semibold text-[var(--text)]">First time scanned</p>
								<p className="text-[var(--text-muted)] mt-0.5">
									{firstTimeModal.eanFound
										? 'Details found via barcode database. Adjust the name if needed and set minimum/maximum stock levels.'
										: 'This article is not yet in the system. Give it a recognizable name and optionally set min/max order levels.'}
								</p>
							</div>
						</div>

						{/* Barcode display */}
						<div className="p-3 bg-[var(--background)] rounded-xl border border-[var(--border)]/15 flex items-center justify-between">
							<span className="text-xs text-[var(--text-muted)] font-medium">Barcode:</span>
							<span className="font-mono text-sm font-bold text-[var(--text)]">{firstTimeModal.barcode}</span>
						</div>

						{/* Title */}
						<div>
							<label className="block text-xs font-semibold text-[var(--text)] mb-1">
								Article Name <span className="text-red-500">*</span>
							</label>
							<input
								type="text"
								autoFocus
								value={firstTimeModal.title}
								onChange={(e) => setFirstTimeModal({ ...firstTimeModal, title: e.target.value })}
								placeholder="Enter recognizable article name..."
								className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>

						{/* Brand */}
						<div>
							<label className="block text-xs font-semibold text-[var(--text)] mb-1">
								Brand <span className="text-[var(--text-muted)] font-normal">(optional)</span>
							</label>
							<input
								type="text"
								value={firstTimeModal.brand}
								onChange={(e) => setFirstTimeModal({ ...firstTimeModal, brand: e.target.value })}
								placeholder="e.g. Niko, Legrand, Schneider..."
								className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>

						{/* Min & Max Grid */}
						<div className="grid grid-cols-2 gap-3 pt-1">
							<div>
								<label className="block text-xs font-semibold text-[var(--text)] mb-1">
									Min. Stock
									<span className="text-[var(--text-muted)] font-normal block sm:inline sm:ml-1 text-[11px]">(threshold)</span>
								</label>
								<input
									type="number"
									min="0"
									value={firstTimeModal.min}
									onChange={(e) => setFirstTimeModal({ ...firstTimeModal, min: e.target.value })}
									placeholder="e.g. 5"
									className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-[var(--text)] mb-1">
									Max. Stock
									<span className="text-[var(--text-muted)] font-normal block sm:inline sm:ml-1 text-[11px]">(target level)</span>
								</label>
								<input
									type="number"
									min="0"
									value={firstTimeModal.max}
									onChange={(e) => setFirstTimeModal({ ...firstTimeModal, max: e.target.value })}
									placeholder="e.g. 20"
									className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
								/>
							</div>
						</div>

						{/* Actions */}
						<div className="flex justify-end gap-2.5 pt-3">
							<Button type="button" variant="secondary" onClick={() => setFirstTimeModal(null)} disabled={isSavingFirstTime}>
								Skip
							</Button>
							<Button type="submit" loading={isSavingFirstTime} className="bg-[var(--accent)] hover:brightness-90 text-white">
								Save & Apply
							</Button>
						</div>
					</form>
				)}
			</Modal>

			{/* Article History & In/Out Graph Modal */}
			<ArticleHistoryModal barcode={historyBarcode} onClose={() => setHistoryBarcode(null)} />
		</div>
	);
}
