'use client';

import { useState, useEffect, useRef } from 'react';
import { useZxing } from 'react-zxing';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { ScanBarcode, Plus, Trash2, Minus, ArrowLeft, Loader2, Edit2, Tag, Check, Keyboard, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '@/providers/PermissionsProvider';
import { submitStockMutation } from './actions';

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
	loading?: boolean;
};

function ScannerVideo({ onResult }: { onResult: (text: string) => void }) {
	const { ref } = useZxing({
		onDecodeResult(result: any) {
			onResult(result.rawValue || result.getText?.() || '');
		},
	});

	return (
		<div className="overflow-hidden rounded-xl bg-black aspect-video max-h-[45vh] relative flex flex-col mt-2">
			<video ref={ref as any} className="w-full h-full object-cover" />
		</div>
	);
}

export default function StockPage() {
	const { has } = usePermissions();
	const canWrite = has('stock.write');

	const [items, setItems] = useState<StockItem[]>([]);
	const [articles, setArticles] = useState<Record<string, ArticleMeta>>({});
	const [isScanning, setIsScanning] = useState(false);
	const [manualCode, setManualCode] = useState('');
	const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
	const [editingItem, setEditingItem] = useState<StockItem | null>(null);
	const [customTitle, setCustomTitle] = useState('');
	const [customBrand, setCustomBrand] = useState('');
	const [customMin, setCustomMin] = useState('');
	const [customMax, setCustomMax] = useState('');
	const [isEditingMeta, setIsEditingMeta] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

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

	// Buffer for hardware/USB barcode scanner input on desktop
	const barcodeBufferRef = useRef<string>('');
	const lastKeyTimeRef = useRef<number>(0);

	const fetchArticleInfo = async (barcode: string) => {
		if (articles[barcode] && !articles[barcode].loading) return;

		setArticles((prev) => ({
			...prev,
			[barcode]: { title: barcode, loading: true },
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
			[barcode]: { title: barcode, loading: false },
		}));
	};

	const handleScan = (code: string) => {
		const cleanCode = code.trim();
		if (!cleanCode) return;

		const delta = scanMode === 'add' ? 1 : -1;
		setItems((prev) => {
			const existing = prev.find((i) => i.code === cleanCode);
			if (existing) {
				return prev.map((i) => (i.code === cleanCode ? { ...i, quantity: i.quantity + delta } : i));
			}
			return [...prev, { code: cleanCode, quantity: delta }];
		});

		fetchArticleInfo(cleanCode);
		setIsScanning(false);
		setManualCode('');
	};

	// Global keyboard barcode scanner support for desktop
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if typing in an input or textarea
			const target = e.target as HTMLElement;
			if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
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
	}, [scanMode]);

	const handleSubmit = async () => {
		if (items.length === 0) return;
		setIsSubmitting(true);
		try {
			const result = await submitStockMutation(items);
			if (result.success) {
				setItems([]);
				alert('Stock mutation saved successfully!');
			} else {
				alert('Failed to save stock mutation: ' + result.error);
			}
		} catch (error: any) {
			console.error(error);
			alert('Failed to save stock mutation: ' + (error.message || 'Network error'));
		} finally {
			setIsSubmitting(false);
		}
	};

	const updateQuantityExact = (code: string, newQuantity: number) => {
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

						{/* Submit / Book Button */}
						<Button
							onClick={handleSubmit}
							disabled={items.length === 0 || isSubmitting}
							loading={isSubmitting}
							icon={<Check size={18} />}
							className="bg-[var(--accent)] text-white hover:brightness-90 disabled:opacity-50"
						>
							<span className="hidden sm:inline">Book</span>
							<span className="sm:hidden">Book ({items.length})</span>
						</Button>
					</div>

					<PageHeader icon={<ScanBarcode size={24} />} title="Stock Inventory" description="Scan of voer barcodes in om artikelen toe te voegen of te verwijderen" />

					{/* Scanned Items List */}
					{items.length === 0 ? (
						<div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)]/10 rounded-2xl bg-[var(--background)] p-8 sm:p-12 min-h-[260px] sm:min-h-[320px] text-center space-y-3">
							<div className="h-12 w-12 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--accent)] shadow-sm">
								<ScanBarcode size={24} />
							</div>
							<p className="font-semibold text-base text-[var(--text)]">Nog geen artikelen gescand</p>
							<p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm">
								Gebruik de knoppen onderaan om via camera te scannen, voer handmatig een barcode in, of gebruik een USB barcodescanner.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{items.map((item) => {
								const isPositive = item.quantity > 0;
								const isNegative = item.quantity < 0;
								const meta = articles[item.code];
								const hasHumanTitle = Boolean(meta?.title && meta.title !== item.code);

								return (
									<div
										key={item.code}
										onClick={() => openEditModal(item)}
										className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl shadow-sm cursor-pointer transition-all hover:scale-[1.008] active:scale-[0.99] gap-3 ${
											isPositive
												? 'bg-[var(--accent)] text-white border border-[var(--accent)]'
												: isNegative
													? 'bg-red-500 text-white border border-red-500'
													: 'bg-[var(--foreground)] text-[var(--text)] border border-[var(--border)]/10'
										}`}
									>
										<div className="flex-1 min-w-0">
											{hasHumanTitle ? (
												<div>
													<p className="font-semibold text-sm sm:text-base truncate leading-snug">{meta?.title}</p>
													<div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
														{meta?.brand && <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-black/15 font-medium">{meta.brand}</span>}
														<span className="font-mono text-[11px] sm:text-xs opacity-75">{item.code}</span>
													</div>
												</div>
											) : (
												<div>
													<p className="font-mono font-semibold truncate text-base sm:text-lg">{item.code}</p>
													{meta?.loading && (
														<span className="text-xs opacity-75 inline-flex items-center gap-1 mt-0.5">
															<Loader2 size={12} className="animate-spin" /> Zoeken op ean-db...
														</span>
													)}
												</div>
											)}
										</div>

										<div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

											<span className="font-bold text-xl sm:text-2xl min-w-[2.5rem] sm:min-w-[3rem] text-center">{isPositive ? `+${item.quantity}` : item.quantity}</span>

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
									</div>
								);
							})}
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
						Scan Uit (-1)
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
					Scan Uit (-1)
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
					title="Barcode handmatig typen"
				>
					Handmatig
				</Button>
			</div>

			{/* Scanner Modal */}
			<Modal open={isScanning} onClose={() => setIsScanning(false)} title={scanMode === 'add' ? 'Scan item in (+1)' : 'Scan item uit (-1)'} size="md">
				<div className="space-y-4">
					<p className="text-xs sm:text-sm text-[var(--text-muted)]">
						Richt de camera op een barcode of voer deze handmatig in. Het artikel wordt automatisch {scanMode === 'add' ? 'toegevoegd (+1)' : 'afgetrokken (-1)'}.
					</p>

					{isScanning && <ScannerVideo onResult={handleScan} />}

					<div className="pt-2 border-t border-[var(--border)]/10 space-y-2">
						<p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Handmatige barcode invoer</p>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (manualCode.trim()) handleScan(manualCode.trim());
							}}
							className="flex gap-2"
						>
							<input
								type="text"
								placeholder="Typ barcode..."
								value={manualCode}
								onChange={(e) => setManualCode(e.target.value)}
								autoFocus
								className="flex-1 h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
							/>
							<Button type="submit" disabled={!manualCode.trim()}>
								Invoeren
							</Button>
						</form>
					</div>
				</div>
			</Modal>

			{/* Edit Item Modal */}
			<Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Artikel bewerken" size="sm">
				{editingItem && (
					<div className="space-y-5 pt-1">
						{/* Article Meta Info */}
						<div className="p-3.5 bg-[var(--background)] rounded-xl border border-[var(--border)]/10 space-y-2">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<p className="text-xs text-[var(--text-muted)] mb-0.5">Artikelnaam</p>
									<p className="font-semibold text-sm text-[var(--text)] leading-snug">{articles[editingItem.code]?.title || editingItem.code}</p>
									{articles[editingItem.code]?.brand && (
										<p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
											<Tag size={12} /> {articles[editingItem.code]?.brand}
										</p>
									)}
								</div>
								{canWrite && (
									<button
										onClick={() => setIsEditingMeta(!isEditingMeta)}
										className="p-1.5 rounded-lg hover:bg-[var(--border)]/15 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors shrink-0"
										title="Naam & instellingen aanpassen"
									>
										<Edit2 size={16} />
									</button>
								)}
							</div>

							<div className="pt-2 border-t border-[var(--border)]/10">
								<p className="text-xs text-[var(--text-muted)] mb-0.5">Barcode</p>
								<p className="font-mono text-xs font-medium text-[var(--text)]">{editingItem.code}</p>
							</div>
						</div>

						{/* Custom Name & Limits Edit Section */}
						{isEditingMeta && (
							<div className="p-3.5 bg-[var(--foreground)] rounded-xl border border-[var(--border)]/15 space-y-3 animate-in fade-in duration-200">
								<p className="text-xs font-semibold text-[var(--text)]">Artikelgegevens & limieten aanpassen</p>
								<div>
									<label className="block text-xs text-[var(--text-muted)] mb-1">Naam</label>
									<input
										type="text"
										value={customTitle}
										onChange={(e) => setCustomTitle(e.target.value)}
										placeholder="Artikelnaam..."
										className="w-full h-10 px-3 rounded-lg border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
									/>
								</div>
								<div>
									<label className="block text-xs text-[var(--text-muted)] mb-1">Merk (optioneel)</label>
									<input
										type="text"
										value={customBrand}
										onChange={(e) => setCustomBrand(e.target.value)}
										placeholder="Merk..."
										className="w-full h-10 px-3 rounded-lg border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
									/>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div>
										<label className="block text-xs text-[var(--text-muted)] mb-1">Min. Voorraad</label>
										<input
											type="number"
											min="0"
											value={customMin}
											onChange={(e) => setCustomMin(e.target.value)}
											placeholder="bv. 5"
											className="w-full h-10 px-3 rounded-lg border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
										/>
									</div>
									<div>
										<label className="block text-xs text-[var(--text-muted)] mb-1">Max. Voorraad</label>
										<input
											type="number"
											min="0"
											value={customMax}
											onChange={(e) => setCustomMax(e.target.value)}
											placeholder="bv. 20"
											className="w-full h-10 px-3 rounded-lg border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
										/>
									</div>
								</div>
								<div className="flex justify-end gap-2 pt-1">
									<Button size="sm" variant="ghost" onClick={() => setIsEditingMeta(false)}>
										Annuleren
									</Button>
									<Button size="sm" onClick={handleSaveCustomMeta}>
										Opslaan
									</Button>
								</div>
							</div>
						)}

						{/* Quantity Input */}
						<div>
							<label className="block text-sm font-medium text-[var(--text)] mb-2">Aantal</label>
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
								Verwijderen
							</Button>
							<Button
								className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)] hover:brightness-90 text-white border-none"
								onClick={() => {
									updateQuantityExact(editingItem.code, editingItem.quantity);
									setEditingItem(null);
								}}
							>
								Opslaan
							</Button>
						</div>
					</div>
				)}
			</Modal>

			{/* First Time Scanned Article Setup Modal */}
			<Modal open={!!firstTimeModal} onClose={() => setFirstTimeModal(null)} title="Nieuw artikel instellen" size="md">
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
								<p className="font-semibold text-[var(--text)]">Eerste keer gescand</p>
								<p className="text-[var(--text-muted)] mt-0.5">
									{firstTimeModal.eanFound
										? 'Gegevens gevonden via de barcode-database. Pas eventueel de naam aan en stel minimale/maximale voorraad in.'
										: 'Dit artikel is nog onbekend in het systeem. Geef het artikel een duidelijke naam en stel optioneel min/max bestelniveaus in.'}
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
								Artikelnaam <span className="text-red-500">*</span>
							</label>
							<input
								type="text"
								autoFocus
								value={firstTimeModal.title}
								onChange={(e) => setFirstTimeModal({ ...firstTimeModal, title: e.target.value })}
								placeholder="Voer herkenbare artikelnaam in..."
								className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>

						{/* Brand */}
						<div>
							<label className="block text-xs font-semibold text-[var(--text)] mb-1">
								Merk <span className="text-[var(--text-muted)] font-normal">(optioneel)</span>
							</label>
							<input
								type="text"
								value={firstTimeModal.brand}
								onChange={(e) => setFirstTimeModal({ ...firstTimeModal, brand: e.target.value })}
								placeholder="bv. Niko, Legrand, Schneider..."
								className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>

						{/* Min & Max Grid */}
						<div className="grid grid-cols-2 gap-3 pt-1">
							<div>
								<label className="block text-xs font-semibold text-[var(--text)] mb-1">
									Min. Voorraad
									<span className="text-[var(--text-muted)] font-normal block sm:inline sm:ml-1 text-[11px]">(drempel)</span>
								</label>
								<input
									type="number"
									min="0"
									value={firstTimeModal.min}
									onChange={(e) => setFirstTimeModal({ ...firstTimeModal, min: e.target.value })}
									placeholder="bv. 5"
									className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-[var(--text)] mb-1">
									Max. Voorraad
									<span className="text-[var(--text-muted)] font-normal block sm:inline sm:ml-1 text-[11px]">(doelniveau)</span>
								</label>
								<input
									type="number"
									min="0"
									value={firstTimeModal.max}
									onChange={(e) => setFirstTimeModal({ ...firstTimeModal, max: e.target.value })}
									placeholder="bv. 20"
									className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
								/>
							</div>
						</div>

						{/* Actions */}
						<div className="flex justify-end gap-2.5 pt-3">
							<Button type="button" variant="secondary" onClick={() => setFirstTimeModal(null)} disabled={isSavingFirstTime}>
								Overslaan
							</Button>
							<Button type="submit" loading={isSavingFirstTime} className="bg-[var(--accent)] hover:brightness-90 text-white">
								Opslaan & Toepassen
							</Button>
						</div>
					</form>
				)}
			</Modal>
		</div>
	);
}
