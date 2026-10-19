/** @format */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import ArticleHistoryModal from '@/components/stock/ArticleHistoryModal';
import { ScanBarcode, Package, ArrowDownRight, ArrowUpRight, History, BarChart3, User, Calendar, FileText, ExternalLink } from 'lucide-react';

type ProjectStockItem = {
	barcode: string;
	title: string;
	brand?: string;
	category?: string;
	takenOut: number;
	returnedIn: number;
	netUsed: number;
	netQty: number;
	lastDate: string;
};

type ProjectStockLog = {
	id: string;
	date: string;
	time: string;
	initials: string;
	userName: string;
	note?: string;
	items: { barcode: string; quantity: number }[];
};

export default function ProjectStock({ client }: { client: string }) {
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState<{
		stats: {
			uniqueArticles: number;
			totalTakenOut: number;
			totalReturnedIn: number;
			bookingsCount: number;
		};
		items: ProjectStockItem[];
		logs: ProjectStockLog[];
		articlesMap: Record<string, any>;
	} | null>(null);
	const [historyBarcode, setHistoryBarcode] = useState<string | null>(null);
	const [historyTitle, setHistoryTitle] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (!client) return;
		setLoading(true);
		fetch(`/api/projects/stock?project=${encodeURIComponent(client)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((res) => {
				if (res) setData(res);
			})
			.catch((err) => console.error('Failed to load project stock:', err))
			.finally(() => setLoading(false));
	}, [client]);

	if (loading) {
		return <Loading title="Loading project materials" description="Fetching stock bookings linked to this project..." />;
	}

	const items = data?.items || [];
	const logs = data?.logs || [];
	const stats = data?.stats || { uniqueArticles: 0, totalTakenOut: 0, totalReturnedIn: 0, bookingsCount: 0 };

	return (
		<div className="space-y-6 pb-8">
			{/* Top Action Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--foreground)] border border-[var(--border)]/15">
				<div>
					<h3 className="font-bold text-base text-[var(--text)] flex items-center gap-2">
						<Package size={18} className="text-[var(--accent)]" />
						Project Materials & Stock Usage
					</h3>
					<p className="text-xs sm:text-sm text-[var(--text-muted)]">
						All warehouse articles booked out or returned for <strong>{client}</strong>.
					</p>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					<Link href={`/dashboard/stock/mutate?project=${encodeURIComponent(client)}&mode=remove`}>
						<Button icon={<ScanBarcode size={16} />}>Book Materials for Project</Button>
					</Link>
				</div>
			</div>

			{/* KPI Summary Cards */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				<Card className="p-4 space-y-1">
					<div className="flex items-center justify-between text-[var(--text-muted)]">
						<span className="text-xs font-semibold">Unique Articles</span>
						<Package size={16} className="text-[var(--accent)]" />
					</div>
					<p className="text-2xl font-bold text-[var(--text)] font-mono">{stats.uniqueArticles}</p>
					<p className="text-[11px] text-[var(--text-muted)]">Distinct barcodes used</p>
				</Card>

				<Card className="p-4 space-y-1">
					<div className="flex items-center justify-between text-rose-500">
						<span className="text-xs font-semibold">Taken Out</span>
						<ArrowDownRight size={16} />
					</div>
					<p className="text-2xl font-bold text-rose-500 font-mono">{stats.totalTakenOut}</p>
					<p className="text-[11px] text-[var(--text-muted)]">Units booked to project</p>
				</Card>

				<Card className="p-4 space-y-1">
					<div className="flex items-center justify-between text-emerald-500">
						<span className="text-xs font-semibold">Returned</span>
						<ArrowUpRight size={16} />
					</div>
					<p className="text-2xl font-bold text-emerald-500 font-mono">{stats.totalReturnedIn}</p>
					<p className="text-[11px] text-[var(--text-muted)]">Unused units returned</p>
				</Card>

				<Card className="p-4 space-y-1">
					<div className="flex items-center justify-between text-[var(--text-muted)]">
						<span className="text-xs font-semibold">Stock Bookings</span>
						<History size={16} />
					</div>
					<p className="text-2xl font-bold text-[var(--text)] font-mono">{stats.bookingsCount}</p>
					<p className="text-[11px] text-[var(--text-muted)]">Linked log batches</p>
				</Card>
			</div>

			{items.length === 0 ? (
				<div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)]/15 rounded-2xl bg-[var(--foreground)]/40 p-12 text-center space-y-3">
					<Package size={36} className="text-[var(--text-muted)] opacity-50" />
					<p className="font-semibold text-[var(--text)]">No materials booked for {client} yet</p>
					<p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md">
						When scanning items in Stock Inventory, select <strong>{client}</strong> in the Project dropdown (or click the button above) to track materials used on this project.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
					{/* Aggregated Articles Table */}
					<div className="xl:col-span-2 space-y-3">
						<h4 className="font-bold text-sm text-[var(--text)] flex items-center gap-2">
							<Package size={16} className="text-[var(--accent)]" />
							Aggregated Materials ({items.length})
						</h4>

						<div className="bg-[var(--foreground)] border border-[var(--border)]/15 rounded-2xl overflow-hidden">
							<div className="grid grid-cols-[1fr_90px_90px_44px] px-4 py-3 bg-[var(--background)] border-b border-[var(--border)]/10 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
								<div>Article</div>
								<div className="text-center">Taken / Ret.</div>
								<div className="text-center">Net Used</div>
								<div />
							</div>

							<div className="divide-y divide-[var(--border)]/10">
								{items.map((item) => (
									<div key={item.barcode} className="grid grid-cols-[1fr_90px_90px_44px] items-center gap-2 px-4 py-3 hover:bg-[var(--background)]/50 transition-colors">
										<div className="min-w-0 pr-2">
											<p className="font-semibold text-sm text-[var(--text)] truncate">{item.title}</p>
											<div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)]">
												{item.brand && <span className="text-[var(--accent)] font-medium">{item.brand}</span>}
												<span className="font-mono">{item.barcode}</span>
												<span>• {item.lastDate}</span>
											</div>
										</div>

										<div className="text-center font-mono text-xs">
											<span className="text-rose-500 font-semibold">-{item.takenOut}</span>
											{item.returnedIn > 0 && <span className="text-emerald-500 ml-1">/ +{item.returnedIn}</span>}
										</div>

										<div className="text-center">
											<span className="inline-block px-2.5 py-1 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] font-mono font-bold text-xs">{item.netUsed} pcs</span>
										</div>

										<div className="flex justify-end">
											<button
												onClick={() => {
													setHistoryBarcode(item.barcode);
													setHistoryTitle(item.title);
												}}
												className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-emerald-500 hover:bg-[var(--border)]/15 transition-colors"
												title="View article stock history"
											>
												<BarChart3 size={15} />
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					{/* Booking Logs Timeline */}
					<div className="space-y-3">
						<h4 className="font-bold text-sm text-[var(--text)] flex items-center gap-2">
							<History size={16} className="text-[var(--accent)]" />
							Project Booking Logs ({logs.length})
						</h4>

						<div className="space-y-2.5">
							{logs.map((log) => (
								<Link
									key={log.id}
									href={`/dashboard/stock/logs/${encodeURIComponent(log.id)}`}
									className="block p-3.5 rounded-2xl bg-[var(--foreground)] border border-[var(--border)]/15 hover:border-[var(--accent)] transition-colors space-y-2"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]">
											<User size={13} className="text-[var(--accent)]" />
											{log.userName}
										</span>
										<span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-mono">
											<Calendar size={11} />
											{log.date} {log.time}
											<ExternalLink size={11} className="ml-0.5 opacity-60" />
										</span>
									</div>

									{log.note && (
										<p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
											<FileText size={12} className="shrink-0" />
											<span className="truncate">{log.note}</span>
										</p>
									)}

									<div className="flex flex-wrap gap-1.5 pt-1">
										{log.items.slice(0, 4).map((li) => {
											const artTitle = data?.articlesMap?.[li.barcode]?.title || li.barcode;
											return (
												<span
													key={li.barcode}
													className={`text-[11px] px-2 py-0.5 rounded-lg font-medium truncate max-w-[200px] ${
														li.quantity < 0
															? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
															: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
													}`}
												>
													{li.quantity > 0 ? `+${li.quantity}` : li.quantity} {artTitle}
												</span>
											);
										})}
										{log.items.length > 4 && <span className="text-[11px] text-[var(--text-muted)] px-1.5 py-0.5">+{log.items.length - 4} more</span>}
									</div>
								</Link>
							))}
						</div>
					</div>
				</div>
			)}

			<ArticleHistoryModal barcode={historyBarcode} fallbackTitle={historyTitle} onClose={() => setHistoryBarcode(null)} />
		</div>
	);
}
