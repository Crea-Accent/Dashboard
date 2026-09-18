'use client';

import { useState } from 'react';
import { useZxing } from 'react-zxing';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { ScanBarcode, Plus, Trash2, X, Minus, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { submitStockMutation } from './actions';

type StockItem = {
	code: string;
	quantity: number;
};

function ScannerVideo({ onResult }: { onResult: (text: string) => void }) {
	const { ref } = useZxing({
		onDecodeResult(result: any) {
			onResult(result.rawValue || result.getText?.() || '');
		},
	});

	return (
		<div className="overflow-hidden rounded-xl bg-black aspect-video relative flex flex-col mt-2">
			<video ref={ref as any} className="w-full h-full object-cover" />
		</div>
	);
}

export default function StockPage() {
	const [items, setItems] = useState<StockItem[]>([]);
	const [isScanning, setIsScanning] = useState(false);
	const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
	const [editingItem, setEditingItem] = useState<StockItem | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

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

	const handleScan = (code: string) => {
		if (!code.trim()) return;
		const delta = scanMode === 'add' ? 1 : -1;
		setItems((prev) => {
			const existing = prev.find((i) => i.code === code);
			if (existing) {
				return prev.map((i) => (i.code === code ? { ...i, quantity: i.quantity + delta } : i));
			}
			return [...prev, { code, quantity: delta }];
		});
		setIsScanning(false);
	};

	const updateQuantityExact = (code: string, newQuantity: number) => {
		setItems((prev) => prev.map((i) => (i.code === code ? { ...i, quantity: newQuantity } : i)));
	};

	const removeItem = (code: string) => {
		setItems((prev) => prev.filter((i) => i.code !== code));
	};

	return (
		<div className="flex flex-col h-[calc(100dvh-56px)] -mt-6 -mx-4 md:-mx-6 overflow-hidden">
			<div className="flex-1 space-y-6 pb-8 px-4 md:px-6 pt-6 overflow-y-auto">
				<div className="flex items-center justify-between mb-2">
					<Link href="/dashboard/stock" className="p-3 bg-[var(--foreground)] hover:bg-[var(--border)] rounded-full transition-colors shadow-sm text-[var(--text)]">
						<ArrowLeft size={24} />
					</Link>

					<button
						onClick={handleSubmit}
						disabled={items.length === 0 || isSubmitting}
						className="p-3 bg-[var(--accent)] text-white hover:brightness-90 disabled:opacity-50 disabled:grayscale rounded-full transition-all shadow-sm"
					>
						<ArrowRight size={24} />
					</button>
				</div>

				<PageHeader icon={<ScanBarcode size={24} />} title="Stock Inventory" description="Manage your stock list" />

				{/* Bare List without Card */}
				{items.length === 0 ? (
					<div className="flex items-center justify-center border-2 border-dashed border-[var(--border)]/10 rounded-2xl bg-[var(--background)] min-h-[300px]">
						<p className="text-[var(--text-muted)] text-center">
							No items scanned yet.
							<br />
							Tap a button below to scan a barcode.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{items.map((item) => {
							const isPositive = item.quantity > 0;
							const isNegative = item.quantity < 0;

							return (
								<div
									key={item.code}
									onClick={() => setEditingItem({ ...item })}
									className={`flex items-center justify-between p-4 rounded-2xl shadow-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
										isPositive
											? 'bg-[var(--accent)] text-white border border-[var(--accent)]'
											: isNegative
												? 'bg-red-500 text-white border border-red-500'
												: 'bg-[var(--foreground)] text-[var(--text)] border border-[var(--border)]/10'
									}`}
								>
									<p className="font-mono font-semibold truncate text-lg pl-2">{item.code}</p>

									<div className="flex items-center gap-2">
										<button
											onClick={(e) => {
												e.stopPropagation();
												updateQuantityExact(item.code, item.quantity - 1);
											}}
											className="p-2 rounded-xl transition-colors hover:bg-black/10 active:bg-black/20"
										>
											<Minus size={22} />
										</button>

										<span className="font-bold text-2xl w-12 text-center">{isPositive ? `+${item.quantity}` : item.quantity}</span>

										<button
											onClick={(e) => {
												e.stopPropagation();
												updateQuantityExact(item.code, item.quantity + 1);
											}}
											className="p-2 rounded-xl transition-colors hover:bg-black/10 active:bg-black/20"
										>
											<Plus size={22} />
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Sticky Bottom Footer */}
			<div className="flex-none flex h-16 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
				<button
					onClick={() => {
						setScanMode('add');
						setIsScanning(true);
					}}
					className="flex-1 bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent)] hover:brightness-90 active:bg-[var(--accent)] active:brightness-75 transition-colors"
					title="Scan item in (Positive)"
				>
					<Plus size={32} />
				</button>

				<button
					onClick={() => {
						setScanMode('remove');
						setIsScanning(true);
					}}
					className="flex-1 bg-red-500 text-white flex items-center justify-center hover:bg-red-600 active:bg-red-700 transition-colors"
					title="Scan item out (Negative)"
				>
					<Minus size={32} />
				</button>
			</div>

			{/* Scanner Modal */}
			<Modal open={isScanning} onClose={() => setIsScanning(false)} title={scanMode === 'add' ? 'Scan item in' : 'Scan item out'} size="md">
				<div className="space-y-4">
					<p className="text-sm text-[var(--text-muted)]">Point your camera at a barcode. It will be {scanMode === 'add' ? 'added (+1)' : 'removed (-1)'} automatically.</p>
					{isScanning && <ScannerVideo onResult={handleScan} />}
				</div>
			</Modal>

			{/* Edit Item Modal */}
			<Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Aantal wijzigen" size="sm">
				{editingItem && (
					<div className="space-y-6 pt-2">
						<div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--border)]/10">
							<p className="text-xs text-[var(--text-muted)] mb-1">Barcode</p>
							<p className="font-mono font-medium">{editingItem.code}</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-[var(--text)] mb-2">Aantal</label>
							<input
								type="number"
								value={editingItem.quantity}
								onChange={(e) => {
									const val = parseInt(e.target.value);
									setEditingItem({ ...editingItem, quantity: isNaN(val) ? (e.target.value as any) : val });
								}}
								className="w-full h-12 px-4 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-lg focus:outline-none focus:border-[var(--accent)]"
							/>
						</div>

						<div className="flex gap-3">
							<Button
								variant="danger-ghost"
								className="flex-1"
								onClick={() => {
									removeItem(editingItem.code);
									setEditingItem(null);
								}}
							>
								<Trash2 size={18} className="mr-2" />
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
		</div>
	);
}
