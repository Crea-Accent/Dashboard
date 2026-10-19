import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import fs from 'fs/promises';
import path from 'path';
import { getAllCachedArticles } from '@/lib/eandb';
import { getUsers } from '@/lib/users';
import { PackageSearch, ScanBarcode, History, Package, ShoppingCart, Truck, ArrowRight, FolderKanban, User, TrendingDown } from 'lucide-react';

function getInitials(name: string) {
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase();
}

export const dynamic = 'force-dynamic';

export default async function StockMenuPage() {
	const [articlesMap, users] = await Promise.all([getAllCachedArticles(), getUsers()]);
	const initialsMap: Record<string, string> = {};
	for (const u of users) {
		if (u.name) initialsMap[getInitials(u.name)] = u.name;
	}

	const stockDir = path.join(process.cwd(), 'data', 'stock');
	const stockTotals: Record<string, number> = {};
	let logFiles: string[] = [];

	const recentLogs: {
		id: string;
		date: string;
		time: string;
		userName: string;
		project?: string;
		note?: string;
		articleCount: number;
		totalIn: number;
		totalOut: number;
	}[] = [];

	try {
		const raw = await fs.readdir(stockDir);
		logFiles = raw.filter((f) => f.endsWith('.json')).sort((a, b) => b.localeCompare(a));

		for (let i = 0; i < logFiles.length; i++) {
			const file = logFiles[i];
			try {
				const content = await fs.readFile(path.join(stockDir, file), 'utf-8');
				const parsed = JSON.parse(content);
				const entries = Object.entries(parsed).filter(([k, v]) => k !== '_meta' && typeof v === 'number') as [string, number][];

				let totalIn = 0;
				let totalOut = 0;
				for (const [bc, qty] of entries) {
					stockTotals[bc] = (stockTotals[bc] || 0) + qty;
					if (qty > 0) totalIn += qty;
					if (qty < 0) totalOut += Math.abs(qty);
				}

				if (i < 5) {
					const id = file.replace('.json', '');
					const [date = '', rawTime = '', initials = '??'] = id.split('_');
					recentLogs.push({
						id,
						date,
						time: rawTime.replace(/-/g, ':'),
						userName: initialsMap[initials] || initials,
						project: parsed._meta?.project,
						note: parsed._meta?.note,
						articleCount: entries.length,
						totalIn,
						totalOut,
					});
				}
			} catch {}
		}
	} catch {}

	const allBarcodes = Array.from(new Set([...Object.keys(articlesMap), ...Object.keys(stockTotals)]));
	const toOrderItems: { barcode: string; title: string; brand?: string; qty: number; min: number; orderQty: number }[] = [];
	const orderedItems: { barcode: string; title: string; brand?: string; qty: number; orderedQty: number }[] = [];

	for (const bc of allBarcodes) {
		const art = articlesMap[bc];
		const qty = stockTotals[bc] ?? 0;
		const orderedQty = art?.orderedQty && art.orderedQty > 0 ? art.orderedQty : 0;

		if (orderedQty > 0) {
			orderedItems.push({
				barcode: bc,
				title: art?.title || bc,
				brand: art?.brand,
				qty,
				orderedQty,
			});
		} else if (art?.min !== undefined && art?.min !== null && qty < art.min) {
			const target = art.max !== undefined && art.max !== null && art.max >= art.min ? art.max : art.min;
			toOrderItems.push({
				barcode: bc,
				title: art?.title || bc,
				brand: art?.brand,
				qty,
				min: art.min,
				orderQty: Math.max(1, target - qty),
			});
		}
	}

	return (
		<div className="space-y-8 max-w-5xl mx-auto pt-4 sm:pt-6 px-4 md:px-0 pb-12">
			<PageHeader icon={<Package size={24} />} title="Stock Management" description="Live warehouse overview, barcode scanning, and transaction logs" />

			{/* Primary Navigation Cards with Live Badges */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-5">
				<Link href="/dashboard/stock/overview" className="block group">
					<Card className="p-6 sm:p-7 h-full flex flex-col justify-between space-y-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--accent)] border-2 border-[var(--border)]/10 cursor-pointer group-hover:bg-[var(--accent)]/5">
						<div className="flex items-start justify-between gap-2">
							<div className="h-13 w-13 rounded-2xl bg-[var(--foreground)] flex items-center justify-center text-[var(--accent)] shadow-sm">
								<PackageSearch size={26} />
							</div>
							<span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-[var(--foreground)] text-[var(--text)] border border-[var(--border)]/15">
								{allBarcodes.length} articles
							</span>
						</div>
						<div>
							<h3 className="font-bold text-lg text-[var(--text)] mb-1 group-hover:text-[var(--accent)] flex items-center gap-1.5">
								Stock Overview
								<ArrowRight size={16} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
							</h3>
							<p className="text-[var(--text-muted)] text-xs sm:text-sm">Manage stock levels, Min/Max thresholds, Excel order lists, and shelf labels.</p>
						</div>
					</Card>
				</Link>

				<Link href="/dashboard/stock/mutate" className="block group">
					<Card className="p-6 sm:p-7 h-full flex flex-col justify-between space-y-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--accent)] border-2 border-[var(--border)]/10 cursor-pointer group-hover:bg-[var(--accent)]/5">
						<div className="flex items-start justify-between gap-2">
							<div className="h-13 w-13 rounded-2xl bg-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)] shadow-sm">
								<ScanBarcode size={26} />
							</div>
							<span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">Camera & USB</span>
						</div>
						<div>
							<h3 className="font-bold text-lg text-[var(--text)] mb-1 group-hover:text-[var(--accent)] flex items-center gap-1.5">
								Scan & Mutate
								<ArrowRight size={16} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
							</h3>
							<p className="text-[var(--text-muted)] text-xs sm:text-sm">Scan or search articles to book stock in or out and link materials to projects.</p>
						</div>
					</Card>
				</Link>

				<Link href="/dashboard/stock/logs" className="block group">
					<Card className="p-6 sm:p-7 h-full flex flex-col justify-between space-y-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--accent)] border-2 border-[var(--border)]/10 cursor-pointer group-hover:bg-[var(--accent)]/5">
						<div className="flex items-start justify-between gap-2">
							<div className="h-13 w-13 rounded-2xl bg-[var(--foreground)] flex items-center justify-center text-[var(--accent)] shadow-sm">
								<History size={26} />
							</div>
							<span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-[var(--foreground)] text-[var(--text)] border border-[var(--border)]/15">
								{logFiles.length} logs
							</span>
						</div>
						<div>
							<h3 className="font-bold text-lg text-[var(--text)] mb-1 group-hover:text-[var(--accent)] flex items-center gap-1.5">
								History Logs
								<ArrowRight size={16} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
							</h3>
							<p className="text-[var(--text-muted)] text-xs sm:text-sm">Search and audit past bookings by technician, project, or article.</p>
						</div>
					</Card>
				</Link>
			</div>

			{/* Live Operational Panels */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left Panel: Replenishment & Incoming Orders */}
				<Card className="p-5 sm:p-6 space-y-4 flex flex-col justify-between">
					<div className="space-y-4">
						<div className="flex items-center justify-between gap-2">
							<h3 className="font-bold text-base text-[var(--text)] flex items-center gap-2">
								<ShoppingCart size={18} className="text-amber-500" />
								Replenishment & Orders
							</h3>
							<div className="flex items-center gap-1.5">
								{toOrderItems.length > 0 && (
									<Link
										href="/dashboard/stock/overview?filter=needsOrder"
										className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition"
									>
										{toOrderItems.length} To Order
									</Link>
								)}
								{orderedItems.length > 0 && (
									<Link
										href="/dashboard/stock/overview?filter=ordered"
										className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition"
									>
										{orderedItems.length} On the Way
									</Link>
								)}
							</div>
						</div>

						{toOrderItems.length === 0 && orderedItems.length === 0 ? (
							<div className="p-8 rounded-2xl bg-[var(--background)] border border-[var(--border)]/10 text-center space-y-1">
								<p className="text-sm font-semibold text-emerald-500">All minimum stock levels are satisfied</p>
								<p className="text-xs text-[var(--text-muted)]">No articles currently need reordering.</p>
							</div>
						) : (
							<div className="space-y-2">
								{toOrderItems.slice(0, 4).map((item) => (
									<Link
										key={item.barcode}
										href="/dashboard/stock/overview?filter=needsOrder"
										className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--background)] border border-amber-500/20 hover:border-amber-500/50 transition-colors"
									>
										<div className="min-w-0">
											<p className="text-sm font-semibold text-[var(--text)] truncate">{item.title}</p>
											<p className="text-xs text-[var(--text-muted)] font-mono">
												Stock: <strong className="text-amber-500">{item.qty}</strong> / Min: {item.min}
											</p>
										</div>
										<span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
											<TrendingDown size={12} /> Order +{item.orderQty}
										</span>
									</Link>
								))}

								{orderedItems.slice(0, 3).map((item) => (
									<Link
										key={item.barcode}
										href="/dashboard/stock/overview?filter=ordered"
										className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--background)] border border-blue-500/20 hover:border-blue-500/50 transition-colors"
									>
										<div className="min-w-0">
											<p className="text-sm font-semibold text-[var(--text)] truncate">{item.title}</p>
											<p className="text-xs text-[var(--text-muted)] font-mono">Current stock: {item.qty}</p>
										</div>
										<span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
											<Truck size={12} /> Ordered +{item.orderedQty}
										</span>
									</Link>
								))}
							</div>
						)}
					</div>

					<div className="pt-2 flex justify-end">
						<Link href="/dashboard/stock/overview">
							<Button variant="secondary" size="sm">
								Open Full Inventory
							</Button>
						</Link>
					</div>
				</Card>

				{/* Right Panel: Recent Bookings */}
				<Card className="p-5 sm:p-6 space-y-4 flex flex-col justify-between">
					<div className="space-y-4">
						<div className="flex items-center justify-between gap-2">
							<h3 className="font-bold text-base text-[var(--text)] flex items-center gap-2">
								<History size={18} className="text-[var(--accent)]" />
								Recent Stock Bookings
							</h3>
							<span className="text-xs text-[var(--text-muted)]">Latest {recentLogs.length}</span>
						</div>

						{recentLogs.length === 0 ? (
							<div className="p-8 rounded-2xl bg-[var(--background)] border border-[var(--border)]/10 text-center text-xs text-[var(--text-muted)]">No bookings recorded yet.</div>
						) : (
							<div className="space-y-2">
								{recentLogs.map((log) => (
									<Link
										key={log.id}
										href={`/dashboard/stock/logs/${encodeURIComponent(log.id)}`}
										className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]/10 hover:border-[var(--accent)] transition-colors"
									>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-xs font-semibold text-[var(--text)] flex items-center gap-1">
													<User size={12} className="text-[var(--accent)]" />
													{log.userName}
												</span>
												<span className="text-xs font-mono text-[var(--text-muted)]">
													{log.date} {log.time}
												</span>
												{log.project && (
													<span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
														<FolderKanban size={10} />
														{log.project}
													</span>
												)}
											</div>
											{log.note && <p className="text-xs text-[var(--text-muted)] italic truncate mt-0.5">&ldquo;{log.note}&rdquo;</p>}
										</div>

										<div className="flex items-center gap-1.5 shrink-0 font-mono text-xs font-bold">
											{log.totalIn > 0 && <span className="text-emerald-500">+{log.totalIn}</span>}
											{log.totalOut > 0 && <span className="text-rose-500">-{log.totalOut}</span>}
										</div>
									</Link>
								))}
							</div>
						)}
					</div>

					<div className="pt-2 flex justify-end">
						<Link href="/dashboard/stock/logs">
							<Button variant="secondary" size="sm">
								View All Logs
							</Button>
						</Link>
					</div>
				</Card>
			</div>
		</div>
	);
}
