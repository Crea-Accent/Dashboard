'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import {
	PackageSearch,
	ArrowLeft,
	ScanBarcode,
	Search,
	RefreshCw,
	AlertTriangle,
	CheckCircle,
	Package,
	FileSpreadsheet,
	Edit2,
	ShoppingCart,
	Tag,
	TrendingDown,
	BarChart3,
	Truck,
	Printer,
	PackageCheck,
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { useToast } from '@/providers/ToastProvider';
import ArticleHistoryModal from '@/components/stock/ArticleHistoryModal';

type StockOverviewItem = {
	barcode: string;
	title: string;
	brand?: string;
	category?: string;
	image?: string;
	min?: number;
	max?: number;
	quantity: number;
	needsOrder?: boolean;
	orderQty?: number;
	orderedQty?: number;
	orderedAt?: string;
	lastMutated?: string;
};

type OverviewStats = {
	totalArticles: number;
	totalItems: number;
	positiveStock: number;
	negativeStock: number;
	zeroStock: number;
	needsOrder: number;
	orderedCount?: number;
};

export default function StockOverviewPage() {
	const toast = useToast();
	const [items, setItems] = useState<StockOverviewItem[]>([]);
	const [stats, setStats] = useState<OverviewStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [filter, setFilter] = useState<'all' | 'needsOrder' | 'ordered' | 'positive' | 'negative' | 'zero'>('all');
	const [brandFilter, setBrandFilter] = useState<string>('');
	const [sortBy, setSortBy] = useState<'title_asc' | 'qty_asc' | 'qty_desc' | 'brand_asc' | 'recent'>('title_asc');

	// History modal state
	const [historyBarcode, setHistoryBarcode] = useState<string | null>(null);
	const [historyTitle, setHistoryTitle] = useState<string | undefined>(undefined);

	// Edit article modal state
	const [editingItem, setEditingItem] = useState<StockOverviewItem | null>(null);
	const [editTitle, setEditTitle] = useState('');
	const [editBrand, setEditBrand] = useState('');
	const [editMin, setEditMin] = useState<string>('');
	const [editMax, setEditMax] = useState<string>('');
	const [editOrderedQty, setEditOrderedQty] = useState<string>('');
	const [isSavingArticle, setIsSavingArticle] = useState(false);
	const [receivingBarcode, setReceivingBarcode] = useState<string | null>(null);

	const loadOverview = async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/stock/overview');
			if (res.ok) {
				const data = await res.json();
				setItems(data.items || []);
				setStats(data.stats || null);
			}
		} catch (err) {
			console.error('Failed to load stock overview:', err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		try {
			const params = new URLSearchParams(window.location.search);
			const urlFilter = params.get('filter');
			if (urlFilter === 'needsOrder' || urlFilter === 'ordered' || urlFilter === 'positive' || urlFilter === 'negative' || urlFilter === 'zero') {
				setFilter(urlFilter);
			}
		} catch {}
		loadOverview();
	}, []);

	const openEditModal = (item: StockOverviewItem) => {
		setEditingItem(item);
		setEditTitle(item.title && item.title !== item.barcode ? item.title : '');
		setEditBrand(item.brand || '');
		setEditMin(item.min !== undefined && item.min !== null ? String(item.min) : '');
		setEditMax(item.max !== undefined && item.max !== null ? String(item.max) : '');
		setEditOrderedQty(item.orderedQty !== undefined && item.orderedQty !== null && item.orderedQty > 0 ? String(item.orderedQty) : '');
	};

	const handleSaveArticle = async () => {
		if (!editingItem) return;
		setIsSavingArticle(true);

		const barcode = editingItem.barcode;
		const minVal = editMin.trim() !== '' ? parseInt(editMin, 10) : undefined;
		const maxVal = editMax.trim() !== '' ? parseInt(editMax, 10) : undefined;
		const orderedVal = editOrderedQty.trim() !== '' ? parseInt(editOrderedQty, 10) : 0;
		const titleVal = editTitle.trim() || barcode;
		const brandVal = editBrand.trim() || undefined;

		try {
			const res = await fetch('/api/stock/articles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					barcode,
					title: titleVal,
					brand: brandVal,
					min: isNaN(minVal as any) ? undefined : minVal,
					max: isNaN(maxVal as any) ? undefined : maxVal,
					orderedQty: isNaN(orderedVal as any) || orderedVal <= 0 ? 0 : orderedVal,
				}),
			});

			if (res.ok) {
				const updatedArticle = (await res.json()).article;
				setItems((prev) =>
					prev.map((i) => {
						if (i.barcode === barcode) {
							const newMin = updatedArticle?.min;
							const newMax = updatedArticle?.max;
							const newOrderedQty = updatedArticle?.orderedQty;
							const belowMin = newMin !== undefined && newMin > 0 && i.quantity < newMin;
							const target = newMax !== undefined && newMax > (newMin || 0) ? newMax : newMin || 0;
							const orderQty = belowMin ? Math.max(1, target - i.quantity) : 0;
							const needsOrder = belowMin && !newOrderedQty;

							return {
								...i,
								title: updatedArticle?.title || titleVal,
								brand: updatedArticle?.brand || brandVal,
								min: newMin,
								max: newMax,
								orderedQty: newOrderedQty,
								orderedAt: updatedArticle?.orderedAt,
								needsOrder,
								orderQty,
							};
						}
						return i;
					})
				);
				setEditingItem(null);
				toast('success', 'Article settings saved');
			} else {
				toast('error', 'Failed to save article');
			}
		} catch (err) {
			console.error('Failed to update article:', err);
			toast('error', 'An error occurred while saving.');
		} finally {
			setIsSavingArticle(false);
		}
	};

	const handleMarkSingleOrdered = async (item: StockOverviewItem) => {
		const qtyToOrder = item.orderQty || 1;
		try {
			const res = await fetch('/api/stock/articles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					markOrdered: [{ barcode: item.barcode, orderedQty: qtyToOrder }],
				}),
			});
			if (res.ok) {
				toast('success', `Marked ${item.title || item.barcode} as ordered (+${qtyToOrder})`);
				await loadOverview();
			}
		} catch (err) {
			console.error('Failed to mark ordered:', err);
			toast('error', 'Failed to update order status');
		}
	};

	const handleReceiveOrder = async (item: StockOverviewItem) => {
		if (!item.orderedQty || item.orderedQty <= 0) return;
		const qty = item.orderedQty;
		setReceivingBarcode(item.barcode);
		try {
			const res = await fetch('/api/stock/mutate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					items: [{ code: item.barcode, quantity: qty }],
					note: `Order received (+${qty})`,
				}),
			});
			if (res.ok) {
				toast('success', `Received +${qty} of ${item.title || item.barcode} into stock!`);
				await loadOverview();
			} else {
				toast('error', 'Failed to book incoming order');
			}
		} catch (err) {
			console.error('Failed to receive order:', err);
			toast('error', 'Error receiving order');
		} finally {
			setReceivingBarcode(null);
		}
	};

	const drawLabelOnDoc = (doc: jsPDF, item: StockOverviewItem) => {
		const title = item.title && item.title !== item.barcode ? item.title : 'Stock Article';
		const brand = item.brand ? item.brand.toUpperCase() : 'CREA-ACCENT';

		// Header Brand & Min/Max
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(6.5);
		doc.setTextColor(90, 90, 90);
		doc.text(brand.slice(0, 26), 3.5, 4.5);

		if (item.min !== undefined || item.max !== undefined) {
			const limitsText = `MIN: ${item.min ?? '-'} / MAX: ${item.max ?? '-'}`;
			doc.text(limitsText, 58.5, 4.5, { align: 'right' });
		}

		// Article Title
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(8.5);
		doc.setTextColor(15, 15, 15);
		const lines = doc.splitTextToSize(title, 55);
		doc.text(lines.slice(0, 2), 3.5, 8.2);

		// Draw crisp barcode bars (Code-128 style visual pattern deterministic to barcode string)
		const codeStr = String(item.barcode);
		const startX = 5;
		const endX = 57;
		const barY = 14.5;
		const barH = 9.5;
		const totalWidth = endX - startX;

		// Build bit pattern from characters + start/stop guards
		const bits: number[] = [1, 1, 0, 1, 0, 0, 1, 0, 0];
		for (let i = 0; i < codeStr.length; i++) {
			const c = codeStr.charCodeAt(i);
			bits.push(1, (c >> 0) & 1, 0, (c >> 1) & 1 || 1, (c >> 2) & 1, 0, (c >> 3) & 1 || 1, (c >> 4) & 1, 0);
		}
		bits.push(1, 1, 0, 0, 1, 1, 0, 1, 1);

		const unitW = totalWidth / bits.length;
		doc.setFillColor(0, 0, 0);
		for (let i = 0; i < bits.length; i++) {
			if (bits[i] === 1) {
				doc.rect(startX + i * unitW, barY, unitW * 1.05, barH, 'F');
			}
		}

		// Human-readable barcode string below bars
		doc.setFont('courier', 'bold');
		doc.setFontSize(7.5);
		doc.setTextColor(0, 0, 0);
		doc.text(codeStr, 31, 27, { align: 'center' });
	};

	const handlePrintLabel = (item: StockOverviewItem) => {
		const doc = new jsPDF({
			orientation: 'landscape',
			unit: 'mm',
			format: [62, 29],
		});
		drawLabelOnDoc(doc, item);
		doc.save(`Label_${item.barcode}.pdf`);
	};

	const handlePrintBatchLabels = () => {
		if (filteredItems.length === 0) {
			toast('error', 'No articles in current filter to print');
			return;
		}
		const doc = new jsPDF({
			orientation: 'landscape',
			unit: 'mm',
			format: [62, 29],
		});
		filteredItems.forEach((item, index) => {
			if (index > 0) {
				doc.addPage([62, 29], 'landscape');
			}
			drawLabelOnDoc(doc, item);
		});
		const todayStr = new Date().toISOString().split('T')[0];
		doc.save(`Shelf_Labels_${filteredItems.length}_Items_${todayStr}.pdf`);
		toast('success', `Generated ${filteredItems.length} shelf labels PDF`);
	};

	// Export order Excel sheet
	const handleExportOrderExcel = async () => {
		const itemsToOrder = items.filter((i) => i.needsOrder);

		if (itemsToOrder.length === 0) {
			alert('All articles are sufficiently in stock or already marked as ordered.');
			return;
		}

		const worksheetData = [
			['Barcode', 'Article Name', 'Brand', 'Category', 'Current Stock', 'Minimum', 'Maximum', 'Order Quantity'],
			...itemsToOrder.map((item) => {
				const target = item.max && item.max > item.min! ? item.max : item.min!;
				const orderQty = Math.max(1, target - item.quantity);
				return [item.barcode, item.title || item.barcode, item.brand || '', item.category || '', item.quantity, item.min ?? '', item.max ?? '', orderQty];
			}),
		];

		const ws = XLSX.utils.aoa_to_sheet(worksheetData);
		ws['!cols'] = [
			{ wch: 18 }, // Barcode
			{ wch: 42 }, // Article Name
			{ wch: 20 }, // Brand
			{ wch: 22 }, // Category
			{ wch: 18 }, // Current Stock
			{ wch: 12 }, // Minimum
			{ wch: 12 }, // Maximum
			{ wch: 20 }, // Order Quantity
		];

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Order List');

		const todayStr = new Date().toISOString().split('T')[0];
		XLSX.writeFile(wb, `Order_List_Stock_${todayStr}.xlsx`);

		// Offer to mark these exported items as Ordered so they aren't ordered twice
		if (confirm(`Mark these ${itemsToOrder.length} exported articles as "Ordered (Awaiting Delivery)"?`)) {
			try {
				const markOrderedPayload = itemsToOrder.map((item) => {
					const target = item.max && item.max > item.min! ? item.max : item.min!;
					const orderQty = Math.max(1, target - item.quantity);
					return { barcode: item.barcode, orderedQty: orderQty };
				});

				const res = await fetch('/api/stock/articles', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ markOrdered: markOrderedPayload }),
				});
				if (res.ok) {
					toast('success', `Marked ${itemsToOrder.length} articles as Ordered`);
					await loadOverview();
				}
			} catch (err) {
				console.error('Failed to mark items as ordered:', err);
			}
		}
	};

	const uniqueBrands = Array.from(new Set(items.map((i) => i.brand?.trim()).filter((b): b is string => Boolean(b)))).sort((a, b) => a.localeCompare(b));

	const filteredItems = items
		.filter((item) => {
			const matchesSearch =
				!search.trim() ||
				item.title.toLowerCase().includes(search.toLowerCase()) ||
				(item.brand && item.brand.toLowerCase().includes(search.toLowerCase())) ||
				(item.category && item.category.toLowerCase().includes(search.toLowerCase())) ||
				item.barcode.includes(search);

			if (!matchesSearch) return false;
			if (brandFilter && (item.brand?.trim() || '') !== brandFilter) return false;

			if (filter === 'needsOrder') return item.needsOrder;
			if (filter === 'ordered') return (item.orderedQty || 0) > 0;
			if (filter === 'positive') return item.quantity > 0;
			if (filter === 'negative') return item.quantity < 0;
			if (filter === 'zero') return item.quantity === 0;

			return true;
		})
		.sort((a, b) => {
			if (sortBy === 'qty_asc') return a.quantity - b.quantity;
			if (sortBy === 'qty_desc') return b.quantity - a.quantity;
			if (sortBy === 'brand_asc') return (a.brand || 'zzz').localeCompare(b.brand || 'zzz');
			if (sortBy === 'recent') {
				const tA = a.lastMutated ? new Date(a.lastMutated).getTime() : 0;
				const tB = b.lastMutated ? new Date(b.lastMutated).getTime() : 0;
				return tB - tA;
			}
			return (a.title || a.barcode).localeCompare(b.title || b.barcode);
		});

	const itemsNeedingOrderCount = items.filter((i) => i.needsOrder).length;
	const itemsOrderedCount = items.filter((i) => (i.orderedQty || 0) > 0).length;

	return (
		<div className="space-y-6 pt-4 sm:pt-6 w-full px-4 sm:px-6">
			{/* Top Bar Navigation */}
			<div className="flex items-center justify-between gap-3">
				<Link
					href="/dashboard/stock"
					className="p-2.5 sm:p-3 bg-[var(--foreground)] hover:bg-[var(--border)]/20 rounded-full transition-colors shadow-sm text-[var(--text)] shrink-0"
					title="Back to Stock"
				>
					<ArrowLeft size={20} className="sm:w-6 sm:h-6" />
				</Link>

				<div className="flex flex-wrap items-center gap-2">
					<Button variant="secondary" icon={<RefreshCw size={16} />} onClick={loadOverview} disabled={loading} title="Refresh">
						<span className="hidden sm:inline">Refresh</span>
					</Button>

					{/* Batch Print Shelf Labels */}
					<Button
						variant="secondary"
						icon={<Printer size={16} />}
						onClick={handlePrintBatchLabels}
						disabled={filteredItems.length === 0}
						title="Print 62x29mm barcode shelf labels for all filtered articles"
					>
						<span className="hidden sm:inline">Print Labels ({filteredItems.length})</span>
						<span className="sm:hidden">Labels ({filteredItems.length})</span>
					</Button>

					{/* Order Button (Excel Export) */}
					<Button
						variant={itemsNeedingOrderCount > 0 ? 'primary' : 'secondary'}
						icon={<FileSpreadsheet size={16} />}
						onClick={handleExportOrderExcel}
						title="Export Excel order list for articles below minimum"
						className={itemsNeedingOrderCount > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
					>
						<span className="hidden sm:inline">Order ({itemsNeedingOrderCount})</span>
						<span className="sm:hidden">Order ({itemsNeedingOrderCount})</span>
					</Button>

					<Link href="/dashboard/stock/mutate">
						<Button icon={<ScanBarcode size={16} />}>
							<span className="hidden sm:inline">Scan & Mutate</span>
							<span className="sm:hidden">Mutate</span>
						</Button>
					</Link>
				</div>
			</div>

			<PageHeader icon={<PackageSearch size={24} />} title="Stock Overview" description="Complete inventory overview with automatic reorder levels (Min / Max)" />

			{/* Stats Bar */}
			{stats && (
				<div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
					<Card className="p-3.5 sm:p-4 flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
							<Package size={20} />
						</div>
						<div className="min-w-0">
							<p className="text-xs text-[var(--text-muted)] font-medium">Articles</p>
							<p className="text-lg sm:text-xl font-bold text-[var(--text)] truncate">{stats.totalArticles}</p>
						</div>
					</Card>

					<Card className="p-3.5 sm:p-4 flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
							<CheckCircle size={20} />
						</div>
						<div className="min-w-0">
							<p className="text-xs text-[var(--text-muted)] font-medium">In Stock</p>
							<p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">{stats.positiveStock}</p>
						</div>
					</Card>

					{/* Needs Order Metric */}
					<Card
						onClick={() => setFilter('needsOrder')}
						className={`p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer transition-all hover:border-amber-500/40 ${filter === 'needsOrder' ? 'ring-2 ring-amber-500' : ''}`}
					>
						<div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
							<ShoppingCart size={20} />
						</div>
						<div className="min-w-0">
							<p className="text-xs text-[var(--text-muted)] font-medium">To Order</p>
							<p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 truncate">{stats.needsOrder}</p>
						</div>
					</Card>

					<Card className="p-3.5 sm:p-4 flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
							<AlertTriangle size={20} />
						</div>
						<div className="min-w-0">
							<p className="text-xs text-[var(--text-muted)] font-medium">Negative</p>
							<p className="text-lg sm:text-xl font-bold text-red-500 truncate">{stats.negativeStock}</p>
						</div>
					</Card>

					<Card className="col-span-2 md:col-span-1 p-3.5 sm:p-4 flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-zinc-500/10 text-zinc-500 flex items-center justify-center shrink-0">
							<PackageSearch size={20} />
						</div>
						<div className="min-w-0">
							<p className="text-xs text-[var(--text-muted)] font-medium">Total Units</p>
							<p className="text-lg sm:text-xl font-bold text-[var(--text)] truncate">{stats.totalItems}</p>
						</div>
					</Card>
				</div>
			)}

			{/* Search and Filters */}
			<div className="flex flex-col gap-3">
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
					<div className="relative flex-1">
						<Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search by article name, brand, category or barcode..."
							className="w-full h-11 pl-10 pr-4 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
						/>
					</div>

					{/* Brand Filter */}
					{uniqueBrands.length > 0 && (
						<select
							value={brandFilter}
							onChange={(e) => setBrandFilter(e.target.value)}
							className="h-11 px-3 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-xs font-medium text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
						>
							<option value="">All Brands ({uniqueBrands.length})</option>
							{uniqueBrands.map((b) => (
								<option key={b} value={b}>
									{b}
								</option>
							))}
						</select>
					)}

					{/* Sort Select */}
					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
						className="h-11 px-3 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-xs font-medium text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
					>
						<option value="title_asc">Sort: Name (A → Z)</option>
						<option value="qty_asc">Sort: Stock (Low → High)</option>
						<option value="qty_desc">Sort: Stock (High → Low)</option>
						<option value="brand_asc">Sort: Brand (A → Z)</option>
						<option value="recent">Sort: Recently Active</option>
					</select>
				</div>

				<div className="flex items-center gap-1.5 p-1 bg-[var(--foreground)] rounded-xl border border-[var(--border)]/15 overflow-x-auto scrollbar-none">
					<button
						onClick={() => setFilter('all')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
							filter === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
						}`}
					>
						All ({items.length})
					</button>

					<button
						onClick={() => setFilter('needsOrder')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
							filter === 'needsOrder' ? 'bg-amber-600 text-white' : 'text-amber-600 dark:text-amber-400 hover:text-[var(--text)]'
						}`}
					>
						<ShoppingCart size={12} />
						To Order ({itemsNeedingOrderCount})
					</button>

					<button
						onClick={() => setFilter('ordered')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
							filter === 'ordered' ? 'bg-blue-600 text-white' : 'text-blue-600 dark:text-blue-400 hover:text-[var(--text)]'
						}`}
					>
						<Truck size={12} />
						Ordered ({itemsOrderedCount})
					</button>

					<button
						onClick={() => setFilter('positive')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
							filter === 'positive' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
						}`}
					>
						In Stock ({stats?.positiveStock ?? 0})
					</button>

					<button
						onClick={() => setFilter('negative')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
							filter === 'negative' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
						}`}
					>
						Negative ({stats?.negativeStock ?? 0})
					</button>

					<button
						onClick={() => setFilter('zero')}
						className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
							filter === 'zero' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
						}`}
					>
						Zero ({stats?.zeroStock ?? 0})
					</button>
				</div>
			</div>

			{/* Full Screen Desktop & Mobile Articles Table */}
			{loading ? (
				<Loading title="Loading inventory" description="Fetching articles and stock levels..." />
			) : filteredItems.length === 0 ? (
				<div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)]/10 rounded-2xl bg-[var(--background)] p-12 text-center space-y-3">
					<PackageSearch size={40} className="text-[var(--text-muted)] opacity-50" />
					<p className="font-semibold text-[var(--text)]">No articles found</p>
					<p className="text-sm text-[var(--text-muted)]">{search || brandFilter ? 'Try another search term or filter.' : 'Scan items first via Scan & Mutate.'}</p>
				</div>
			) : (
				<div className="bg-[var(--background)] border border-[var(--border)]/10 rounded-2xl overflow-hidden shadow-sm">
					{/* Desktop Table Header */}
					<div className="hidden lg:grid grid-cols-[minmax(250px,2fr)_minmax(120px,1fr)_110px_120px_170px_115px] bg-[var(--foreground)] px-4 py-3 border-b border-[var(--border)]/10 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
						<button
							type="button"
							onClick={() => setSortBy('title_asc')}
							className={`text-left hover:text-[var(--text)] transition-colors ${sortBy === 'title_asc' ? 'text-[var(--accent)] font-bold' : ''}`}
						>
							Article & Barcode
						</button>
						<button
							type="button"
							onClick={() => setSortBy('brand_asc')}
							className={`text-left hover:text-[var(--text)] transition-colors ${sortBy === 'brand_asc' ? 'text-[var(--accent)] font-bold' : ''}`}
						>
							Brand / Category
						</button>
						<div className="text-center">Min / Max</div>
						<button
							type="button"
							onClick={() => setSortBy(sortBy === 'qty_asc' ? 'qty_desc' : 'qty_asc')}
							className={`text-center hover:text-[var(--text)] transition-colors ${sortBy === 'qty_asc' || sortBy === 'qty_desc' ? 'text-[var(--accent)] font-bold' : ''}`}
						>
							Current Stock {sortBy === 'qty_asc' ? '↑' : sortBy === 'qty_desc' ? '↓' : ''}
						</button>
						<div className="text-center">Order Status</div>
						<div className="text-right">Actions</div>
					</div>

					<div className="divide-y divide-[var(--border)]/10">
						{filteredItems.map((item) => {
							const isPositive = item.quantity > 0;
							const isNegative = item.quantity < 0;
							const hasTitle = item.title && item.title !== item.barcode;
							const hasMin = item.min !== undefined && item.min !== null;
							const hasMax = item.max !== undefined && item.max !== null;
							const isOrdered = (item.orderedQty || 0) > 0;

							return (
								<div
									key={item.barcode}
									className={`p-3.5 sm:p-4 hover:bg-[var(--foreground)]/40 transition-colors ${item.needsOrder ? 'bg-amber-500/[0.03]' : isOrdered ? 'bg-blue-500/[0.03]' : ''}`}
								>
									{/* Desktop Row */}
									<div className="hidden lg:grid grid-cols-[minmax(250px,2fr)_minmax(120px,1fr)_110px_120px_170px_115px] items-center gap-3">
										{/* Title & Barcode */}
										<div className="min-w-0 pr-2">
											<p className="font-semibold text-sm text-[var(--text)] truncate" title={item.title}>
												{hasTitle ? item.title : item.barcode}
											</p>
											<div className="flex items-center gap-2 mt-0.5">
												<span className="font-mono text-xs text-[var(--text-muted)]">{item.barcode}</span>
												{item.lastMutated && <span className="text-[11px] text-[var(--text-muted)] opacity-60">• {item.lastMutated}</span>}
											</div>
										</div>

										{/* Brand & Category */}
										<div className="min-w-0">
											{item.brand && (
												<span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium truncate max-w-full">
													{item.brand}
												</span>
											)}
											{item.category && <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{item.category}</p>}
										</div>

										{/* Min / Max Levels */}
										<div className="text-center">
											{hasMin || hasMax ? (
												<div className="text-xs font-mono text-[var(--text)]">
													<span className={item.needsOrder ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>{hasMin ? item.min : '-'}</span>
													<span className="text-[var(--text-muted)] mx-1">/</span>
													<span>{hasMax ? item.max : '-'}</span>
												</div>
											) : (
												<span className="text-xs text-[var(--text-muted)] opacity-50">-</span>
											)}
										</div>

										{/* Current Stock */}
										<div className="text-center">
											<button
												onClick={() => {
													setHistoryBarcode(item.barcode);
													setHistoryTitle(item.title);
												}}
												className="cursor-pointer group inline-block"
												title="Click to view in/out stock history graph"
											>
												<span
													className={`inline-block px-3 py-1 rounded-xl font-bold text-sm min-w-[3.5rem] transition-transform group-hover:scale-105 ${
														isPositive
															? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20'
															: isNegative
																? 'bg-red-500/10 text-red-500 border border-red-500/20 group-hover:bg-red-500/20'
																: 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 group-hover:bg-zinc-500/20'
													}`}
												>
													{isPositive ? `+${item.quantity}` : item.quantity}
												</span>
											</button>
										</div>

										{/* Order Status */}
										<div className="flex flex-col items-center justify-center gap-1">
											{isOrdered ? (
												<div className="flex items-center gap-1.5">
													<span
														className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20"
														title={item.orderedAt ? `Ordered on ${item.orderedAt}` : 'Marked as ordered'}
													>
														<Truck size={11} />+{item.orderedQty}
													</span>
													<button
														onClick={() => handleReceiveOrder(item)}
														disabled={receivingBarcode === item.barcode}
														className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
														title={`Book +${item.orderedQty} into stock now`}
													>
														<CheckCircle size={11} />
														{receivingBarcode === item.barcode ? '...' : 'Receive'}
													</button>
												</div>
											) : item.needsOrder ? (
												<button
													onClick={() => handleMarkSingleOrdered(item)}
													className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 transition-colors cursor-pointer"
													title="Click to mark as ordered (on the way)"
												>
													<TrendingDown size={12} />
													Order +{item.orderQty}
												</button>
											) : hasMin ? (
												<span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Optimal</span>
											) : (
												<span className="text-xs text-[var(--text-muted)] opacity-50">No min</span>
											)}
										</div>

										{/* Action Buttons */}
										<div className="flex items-center justify-end gap-1">
											<button
												onClick={() => handlePrintLabel(item)}
												className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/20 transition-colors"
												title="Download printable barcode label (PDF)"
											>
												<Printer size={16} />
											</button>
											<button
												onClick={() => {
													setHistoryBarcode(item.barcode);
													setHistoryTitle(item.title);
												}}
												className="p-2 rounded-xl text-[var(--text-muted)] hover:text-emerald-500 hover:bg-[var(--border)]/20 transition-colors"
												title="View in & out history graph"
											>
												<BarChart3 size={16} />
											</button>
											<button
												onClick={() => openEditModal(item)}
												className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--border)]/20 transition-colors"
												title="Edit article & stock limits"
											>
												<Edit2 size={16} />
											</button>
										</div>
									</div>

									{/* Mobile Card Row */}
									<div className="lg:hidden flex flex-col gap-2.5">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="font-semibold text-sm sm:text-base text-[var(--text)] leading-snug">{hasTitle ? item.title : item.barcode}</p>
												<div className="flex flex-wrap items-center gap-1.5 mt-1">
													{item.brand && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">{item.brand}</span>}
													<span className="font-mono text-xs text-[var(--text-muted)]">{item.barcode}</span>
												</div>
											</div>

											{/* Current Quantity Badge */}
											<button
												onClick={() => {
													setHistoryBarcode(item.barcode);
													setHistoryTitle(item.title);
												}}
												title="Click to view history"
												className={`px-3 py-1.5 rounded-xl font-bold text-sm min-w-[3.25rem] text-center shrink-0 cursor-pointer active:scale-95 transition-transform ${
													isPositive
														? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
														: isNegative
															? 'bg-red-500/10 text-red-500 border border-red-500/20'
															: 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
												}`}
											>
												{isPositive ? `+${item.quantity}` : item.quantity}
											</button>
										</div>

										{/* Mobile Subline with Min/Max, Order status, and Action buttons */}
										<div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border)]/10 text-xs">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-[var(--text-muted)]">
													Min: <strong className={item.needsOrder ? 'text-amber-500' : 'text-[var(--text)]'}>{hasMin ? item.min : '-'}</strong> | Max:{' '}
													<strong className="text-[var(--text)]">{hasMax ? item.max : '-'}</strong>
												</span>

												{isOrdered ? (
													<div className="flex items-center gap-1">
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
															<Truck size={11} />
															Ordered +{item.orderedQty}
														</span>
														<button
															onClick={() => handleReceiveOrder(item)}
															disabled={receivingBarcode === item.barcode}
															className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-semibold text-[11px]"
														>
															<CheckCircle size={11} />
															Receive
														</button>
													</div>
												) : item.needsOrder ? (
													<button
														onClick={() => handleMarkSingleOrdered(item)}
														className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold text-[11px]"
													>
														Order +{item.orderQty}
													</button>
												) : null}
											</div>

											<div className="flex items-center gap-1">
												<button
													onClick={() => handlePrintLabel(item)}
													className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--border)]/10 rounded-lg flex items-center gap-1 font-medium"
													title="Print barcode label"
												>
													<Printer size={14} />
												</button>

												<button
													onClick={() => {
														setHistoryBarcode(item.barcode);
														setHistoryTitle(item.title);
													}}
													className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg flex items-center gap-1 font-medium"
													title="View in/out history graph"
												>
													<BarChart3 size={14} />
													History
												</button>

												<button
													onClick={() => openEditModal(item)}
													className="p-1.5 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg flex items-center gap-1 font-medium"
												>
													<Edit2 size={14} />
													Edit
												</button>
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Edit Article & Min/Max Modal */}
			<Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Article & Stock Limits" size="md">
				{editingItem && (
					<div className="space-y-4 pt-1">
						{/* Barcode Display */}
						<div className="p-3 bg-[var(--background)] rounded-xl border border-[var(--border)]/10 flex items-center justify-between">
							<div>
								<p className="text-xs text-[var(--text-muted)] mb-0.5">Barcode</p>
								<p className="font-mono text-sm font-semibold text-[var(--text)]">{editingItem.barcode}</p>
							</div>
							<Button type="button" variant="secondary" icon={<Printer size={14} />} onClick={() => handlePrintLabel(editingItem)}>
								Print Label
							</Button>
						</div>

						{/* Title Input */}
						<div>
							<label className="block text-xs font-semibold text-[var(--text)] mb-1">Article Name</label>
							<input
								type="text"
								value={editTitle}
								onChange={(e) => setEditTitle(e.target.value)}
								placeholder="Enter recognizable article name..."
								className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>

						{/* Brand Input */}
						<div>
							<label className="block text-xs font-semibold text-[var(--text)] mb-1">Brand (optional)</label>
							<input
								type="text"
								value={editBrand}
								onChange={(e) => setEditBrand(e.target.value)}
								placeholder="e.g. Legrand, Schneider, Wago..."
								className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>

						{/* Min, Max & Ordered Inputs */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
							<div>
								<label className="block text-xs font-semibold text-[var(--text)] mb-1">
									Min. Stock
									<span className="text-[var(--text-muted)] font-normal block text-[11px]">(reorder threshold)</span>
								</label>
								<input
									type="number"
									min="0"
									value={editMin}
									onChange={(e) => setEditMin(e.target.value)}
									placeholder="e.g. 5"
									className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-[var(--text)] mb-1">
									Max. Stock
									<span className="text-[var(--text-muted)] font-normal block text-[11px]">(target level)</span>
								</label>
								<input
									type="number"
									min="0"
									value={editMax}
									onChange={(e) => setEditMax(e.target.value)}
									placeholder="e.g. 20"
									className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-[var(--text)] mb-1">
									Ordered Qty
									<span className="text-[var(--text-muted)] font-normal block text-[11px]">(on the way)</span>
								</label>
								<input
									type="number"
									min="0"
									value={editOrderedQty}
									onChange={(e) => setEditOrderedQty(e.target.value)}
									placeholder="0"
									className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
								/>
							</div>
						</div>

						{/* Order Logic Explanation */}
						<div className="p-3 bg-[var(--foreground)] rounded-xl border border-[var(--border)]/10 text-xs text-[var(--text-muted)] space-y-1">
							<p className="font-semibold text-[var(--text)] flex items-center gap-1.5">
								<ShoppingCart size={14} className="text-amber-500" />
								Automatic Reorder Rule:
							</p>
							<p>
								When stock falls below the <strong>Minimum</strong>, this article is automatically included in the Excel order list and replenished up to the <strong>Maximum</strong>{' '}
								(or to Minimum if no Maximum is set). Items marked with an <strong>Ordered Qty</strong> are paused from new order lists until received.
							</p>
						</div>

						{/* Modal Actions */}
						<div className="flex items-center justify-between gap-2.5 pt-2">
							<Button
								type="button"
								variant="secondary"
								icon={<BarChart3 size={16} />}
								onClick={() => {
									setHistoryBarcode(editingItem.barcode);
									setHistoryTitle(editingItem.title);
								}}
							>
								History
							</Button>

							<div className="flex gap-2">
								<Button variant="secondary" onClick={() => setEditingItem(null)} disabled={isSavingArticle}>
									Cancel
								</Button>
								<Button onClick={handleSaveArticle} loading={isSavingArticle}>
									Save
								</Button>
							</div>
						</div>
					</div>
				)}
			</Modal>

			{/* Article History & In/Out Graph Modal */}
			<ArticleHistoryModal barcode={historyBarcode} fallbackTitle={historyTitle} onClose={() => setHistoryBarcode(null)} />
		</div>
	);
}
