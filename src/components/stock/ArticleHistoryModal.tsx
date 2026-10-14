/** @format */
'use client';

import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import { TrendingUp, TrendingDown, History, Package, Calendar, User, ArrowUpRight, ArrowDownRight, FileText, RefreshCw, Sparkles, Tag, BarChart3, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type MutationRecord = {
	id: string;
	file: string;
	logId: string;
	date: string;
	time: string;
	formattedDate: string;
	initials: string;
	userName: string;
	quantity: number;
	type: 'in' | 'out';
	balanceAfter: number;
};

type DailyStat = {
	date: string;
	formattedDate: string;
	inQty: number;
	outQty: number;
	netQty: number;
	balance: number;
	mutations: number;
};

type ArticleHistoryData = {
	barcode: string;
	article: {
		barcode: string;
		title: string;
		brand?: string;
		category?: string;
		min?: number;
		max?: number;
		image?: string;
	};
	summary: {
		totalIn: number;
		totalOut: number;
		currentStock: number;
		mutationCount: number;
		firstMutated?: string;
		lastMutated?: string;
	};
	daily: DailyStat[];
	mutations: MutationRecord[];
};

type Props = {
	barcode: string | null;
	onClose: () => void;
	fallbackTitle?: string;
};

export default function ArticleHistoryModal({ barcode, onClose, fallbackTitle }: Props) {
	const [data, setData] = useState<ArticleHistoryData | null>(null);
	const [loading, setLoading] = useState(false);
	const [timeRange, setTimeRange] = useState<'all' | '30d' | '7d'>('all');
	const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

	const loadHistory = async () => {
		if (!barcode) return;
		setLoading(true);
		setActivePointIndex(null);
		try {
			const res = await fetch(`/api/stock/history?barcode=${encodeURIComponent(barcode)}`);
			if (res.ok) {
				const json = await res.json();
				setData(json);
			} else {
				console.error('Failed to load history:', res.statusText);
			}
		} catch (err) {
			console.error('Error fetching article history:', err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (barcode) {
			loadHistory();
		} else {
			setData(null);
			setActivePointIndex(null);
		}
	}, [barcode]);

	// Filter daily stats and mutations based on timeRange
	const filteredData = useMemo(() => {
		if (!data) return { daily: [], mutations: [] };

		if (timeRange === 'all') {
			return { daily: data.daily, mutations: data.mutations };
		}

		const days = timeRange === '7d' ? 7 : 30;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);
		const cutoffStr = cutoffDate.toISOString().split('T')[0];

		const daily = data.daily.filter((d) => d.date >= cutoffStr);
		const mutations = data.mutations.filter((m) => m.date >= cutoffStr);

		return { daily, mutations };
	}, [data, timeRange]);

	// SVG Graph Dimensions & Scaling
	const chartConfig = useMemo(() => {
		const points = filteredData.daily;
		const width = 640;
		const height = 200;
		const padLeft = 45;
		const padRight = 30;
		const padTop = 25;
		const padBottom = 35;
		const plotW = width - padLeft - padRight;
		const plotH = height - padTop - padBottom;

		if (points.length === 0) {
			return {
				width,
				height,
				padLeft,
				padRight,
				padTop,
				padBottom,
				plotW,
				plotH,
				maxVal: 10,
				minVal: 0,
				zeroY: padTop + plotH,
				points: [],
				balancePath: '',
			};
		}

		// Find peak values across all in/out and running balance
		let maxVal = 5;
		let minVal = 0;

		for (const p of points) {
			if (p.inQty > maxVal) maxVal = p.inQty;
			if (p.outQty > maxVal) maxVal = p.outQty;
			if (p.balance > maxVal) maxVal = p.balance;
			if (p.balance < minVal) minVal = p.balance;
		}

		// Round up maxVal for pleasant grid ticks
		maxVal = Math.ceil(maxVal * 1.15);
		if (maxVal < 5) maxVal = 5;

		const rangeY = maxVal - minVal || 1;
		const getY = (val: number) => padTop + plotH - ((val - minVal) / rangeY) * plotH;
		const zeroY = getY(0);

		// Compute coords for each daily bucket
		const barWidth = Math.max(6, Math.min(22, (plotW / points.length) * 0.32));
		const calculatedPoints = points.map((p, idx) => {
			const xCenter = points.length === 1 ? padLeft + plotW / 2 : padLeft + (idx / (points.length - 1)) * plotW;

			const inH = ((p.inQty || 0) / rangeY) * plotH;
			const outH = ((p.outQty || 0) / rangeY) * plotH;

			return {
				...p,
				xCenter,
				inX: xCenter - barWidth - 1.5,
				inY: zeroY - inH,
				inHeight: Math.max(2, inH),
				outX: xCenter + 1.5,
				outY: zeroY - outH,
				outHeight: Math.max(2, outH),
				barWidth,
				balanceY: getY(p.balance),
			};
		});

		// Build SVG path for cumulative balance trendline
		let balancePath = '';
		if (calculatedPoints.length > 0) {
			balancePath = calculatedPoints.reduce((acc, pt, i) => {
				return i === 0 ? `M ${pt.xCenter} ${pt.balanceY}` : `${acc} L ${pt.xCenter} ${pt.balanceY}`;
			}, '');
		}

		return {
			width,
			height,
			padLeft,
			padRight,
			padTop,
			padBottom,
			plotW,
			plotH,
			maxVal,
			minVal,
			zeroY,
			points: calculatedPoints,
			balancePath,
		};
	}, [filteredData.daily]);

	const activePoint = activePointIndex !== null && chartConfig.points[activePointIndex] ? chartConfig.points[activePointIndex] : null;

	const titleText = data?.article?.title || fallbackTitle || barcode || 'Article';
	const brandText = data?.article?.brand;

	return (
		<Modal open={!!barcode} onClose={onClose} title="Article History & Stock Flow" size="3xl">
			<div className="space-y-6 pt-1 max-h-[80vh] overflow-y-auto pr-1">
				{/* Article Header Details */}
				<div className="p-4 bg-[var(--background)] rounded-2xl border border-[var(--border)]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<span className="p-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
								<Package size={20} />
							</span>
							<div className="min-w-0">
								<h3 className="font-bold text-base sm:text-lg text-[var(--text)] truncate">{titleText}</h3>
								<div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
									{brandText && (
										<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
											<Tag size={11} /> {brandText}
										</span>
									)}
									<span className="font-mono text-xs opacity-80">{barcode}</span>
									{data?.article?.category && <span>• {data.article.category}</span>}
								</div>
							</div>
						</div>
					</div>

					{/* Quick Stock Status Pill */}
					{data && (
						<div className="flex items-center gap-2 shrink-0">
							<div className="px-3.5 py-1.5 rounded-xl bg-[var(--foreground)] border border-[var(--border)]/10 text-right">
								<span className="text-[11px] text-[var(--text-muted)] block font-medium">Current Stock</span>
								<span
									className={`text-lg font-bold font-mono ${
										data.summary.currentStock > 0 ? 'text-emerald-500' : data.summary.currentStock < 0 ? 'text-red-500' : 'text-[var(--text-muted)]'
									}`}
								>
									{data.summary.currentStock > 0 ? `+${data.summary.currentStock}` : data.summary.currentStock}
								</span>
							</div>
						</div>
					)}
				</div>

				{loading ? (
					<div className="py-12">
						<Loading title="Loading history" description="Gathering all in and out stock transactions..." />
					</div>
				) : !data || data.mutations.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-[var(--border)]/15 rounded-2xl text-center space-y-3">
						<div className="h-12 w-12 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--text-muted)]">
							<History size={24} />
						</div>
						<p className="font-semibold text-base text-[var(--text)]">No mutations found</p>
						<p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm">
							No stock mutations have been recorded yet for barcode <span className="font-mono">{barcode}</span>.
						</p>
					</div>
				) : (
					<>
						{/* Summary KPI Cards */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
							{/* Total IN */}
							<div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1">
								<div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
									<span className="text-xs font-semibold">Total In</span>
									<ArrowUpRight size={16} />
								</div>
								<p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">+{data.summary.totalIn}</p>
								<p className="text-[11px] text-[var(--text-muted)]">Added to inventory</p>
							</div>

							{/* Total OUT */}
							<div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-1">
								<div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
									<span className="text-xs font-semibold">Total Out</span>
									<ArrowDownRight size={16} />
								</div>
								<p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">-{data.summary.totalOut}</p>
								<p className="text-[11px] text-[var(--text-muted)]">Used / booked out</p>
							</div>

							{/* Net Stock / Current */}
							<div className="p-3.5 bg-[var(--foreground)] border border-[var(--border)]/15 rounded-2xl space-y-1">
								<div className="flex items-center justify-between text-[var(--text)]">
									<span className="text-xs font-semibold">Net Balance</span>
									<Package size={16} className="text-[var(--accent)]" />
								</div>
								<p className="text-xl sm:text-2xl font-bold text-[var(--text)] font-mono">
									{data.summary.currentStock > 0 ? `+${data.summary.currentStock}` : data.summary.currentStock}
								</p>
								<p className="text-[11px] text-[var(--text-muted)]">Current stock level</p>
							</div>

							{/* Total Transactions */}
							<div className="p-3.5 bg-[var(--foreground)] border border-[var(--border)]/15 rounded-2xl space-y-1">
								<div className="flex items-center justify-between text-[var(--text)]">
									<span className="text-xs font-semibold">Bookings</span>
									<History size={16} className="text-[var(--text-muted)]" />
								</div>
								<p className="text-xl sm:text-2xl font-bold text-[var(--text)] font-mono">{data.summary.mutationCount}</p>
								<p className="text-[11px] text-[var(--text-muted)]">Recorded batches</p>
							</div>
						</div>

						{/* Graph Section */}
						<div className="p-4 sm:p-5 bg-[var(--foreground)] border border-[var(--border)]/15 rounded-2xl space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<BarChart3 size={18} className="text-[var(--accent)]" />
									<h4 className="font-bold text-sm text-[var(--text)]">In & Out Flow Chart</h4>
								</div>

								{/* Time Range Selector */}
								<div className="flex items-center gap-1.5 p-1 bg-[var(--background)] rounded-xl border border-[var(--border)]/15 text-xs">
									<button
										onClick={() => setTimeRange('7d')}
										className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
											timeRange === '7d' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
										}`}
									>
										7 Days
									</button>
									<button
										onClick={() => setTimeRange('30d')}
										className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
											timeRange === '30d' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
										}`}
									>
										30 Days
									</button>
									<button
										onClick={() => setTimeRange('all')}
										className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
											timeRange === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
										}`}
									>
										All ({data.daily.length}d)
									</button>
								</div>
							</div>

							{/* Legend */}
							<div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] pt-1">
								<div className="flex items-center gap-1.5">
									<span className="w-3 h-3 rounded-md bg-emerald-500 shrink-0" />
									<span>Incoming (+In)</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="w-3 h-3 rounded-md bg-rose-500 shrink-0" />
									<span>Outgoing (-Out)</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="w-3 h-0.5 bg-[var(--accent)] shrink-0" />
									<span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] -ml-2 shrink-0" />
									<span>Stock Level (Balance)</span>
								</div>
							</div>

							{/* SVG Chart */}
							{chartConfig.points.length === 0 ? (
								<div className="py-8 text-center text-xs text-[var(--text-muted)]">No mutations found in the selected time range.</div>
							) : (
								<div className="relative w-full overflow-x-auto">
									<svg viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`} className="w-full h-48 sm:h-56 select-none">
										{/* Horizontal Grid lines */}
										<line
											x1={chartConfig.padLeft}
											y1={chartConfig.padTop}
											x2={chartConfig.width - chartConfig.padRight}
											y2={chartConfig.padTop}
											stroke="currentColor"
											strokeOpacity="0.08"
											strokeDasharray="4 4"
										/>
										<line
											x1={chartConfig.padLeft}
											y1={chartConfig.padTop + chartConfig.plotH / 2}
											x2={chartConfig.width - chartConfig.padRight}
											y2={chartConfig.padTop + chartConfig.plotH / 2}
											stroke="currentColor"
											strokeOpacity="0.08"
											strokeDasharray="4 4"
										/>
										<line
											x1={chartConfig.padLeft}
											y1={chartConfig.zeroY}
											x2={chartConfig.width - chartConfig.padRight}
											y2={chartConfig.zeroY}
											stroke="currentColor"
											strokeOpacity="0.25"
										/>

										{/* Y Axis Labels */}
										<text x={chartConfig.padLeft - 8} y={chartConfig.padTop + 4} textAnchor="end" className="fill-[var(--text-muted)] text-[10px] font-mono">
											{chartConfig.maxVal}
										</text>
										<text
											x={chartConfig.padLeft - 8}
											y={chartConfig.padTop + chartConfig.plotH / 2 + 4}
											textAnchor="end"
											className="fill-[var(--text-muted)] text-[10px] font-mono"
										>
											{Math.round(chartConfig.maxVal / 2)}
										</text>
										<text x={chartConfig.padLeft - 8} y={chartConfig.zeroY + 4} textAnchor="end" className="fill-[var(--text-muted)] text-[10px] font-mono">
											0
										</text>

										{/* Bars for each day */}
										{chartConfig.points.map((p, idx) => {
											const isHovered = activePointIndex === idx;

											return (
												<g key={p.date} className="cursor-pointer transition-opacity" onClick={() => setActivePointIndex(idx)} onMouseEnter={() => setActivePointIndex(idx)}>
													{/* Hover highlight background column */}
													{isHovered && (
														<rect
															x={p.xCenter - p.barWidth * 1.8}
															y={chartConfig.padTop}
															width={p.barWidth * 3.6}
															height={chartConfig.plotH}
															fill="currentColor"
															fillOpacity="0.05"
															rx="6"
														/>
													)}

													{/* IN Bar (Emerald) */}
													{p.inQty > 0 && (
														<rect x={p.inX} y={p.inY} width={p.barWidth} height={p.inHeight} fill="#10b981" rx="3" className="transition-all hover:brightness-110" />
													)}

													{/* OUT Bar (Rose) */}
													{p.outQty > 0 && (
														<rect x={p.outX} y={p.outY} width={p.barWidth} height={p.outHeight} fill="#f43f5e" rx="3" className="transition-all hover:brightness-110" />
													)}

													{/* Date X-Axis tick label */}
													<text
														x={p.xCenter}
														y={chartConfig.height - 12}
														textAnchor="middle"
														className={`fill-[var(--text-muted)] text-[10px] font-sans ${isHovered ? 'font-bold fill-[var(--text)]' : ''}`}
													>
														{p.date.slice(5)}
													</text>
												</g>
											);
										})}

										{/* Balance Trend Line */}
										{chartConfig.balancePath && (
											<path d={chartConfig.balancePath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
										)}

										{/* Balance Points */}
										{chartConfig.points.map((p, idx) => {
											const isHovered = activePointIndex === idx;

											return (
												<circle
													key={`circle-${p.date}`}
													cx={p.xCenter}
													cy={p.balanceY}
													r={isHovered ? 6 : 4}
													fill="var(--background)"
													stroke="var(--accent)"
													strokeWidth={isHovered ? 3 : 2}
													className="cursor-pointer transition-all"
													onClick={() => setActivePointIndex(idx)}
													onMouseEnter={() => setActivePointIndex(idx)}
												/>
											);
										})}
									</svg>
								</div>
							)}

							{/* Interactive Detail Box on Hover / Selection */}
							{activePoint && (
								<div className="p-3 bg-[var(--background)] rounded-xl border border-[var(--accent)]/30 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
									<div className="flex items-center gap-2">
										<Calendar size={14} className="text-[var(--accent)]" />
										<span className="font-semibold text-[var(--text)]">{activePoint.formattedDate}</span>
										<span className="text-[var(--text-muted)]">({activePoint.mutations} bookings)</span>
									</div>

									<div className="flex items-center gap-4 font-mono">
										<span className="text-emerald-500 font-bold">In: +{activePoint.inQty}</span>
										<span className="text-rose-500 font-bold">Out: -{activePoint.outQty}</span>
										<span className="font-bold text-[var(--text)] bg-[var(--foreground)] px-2 py-0.5 rounded-lg border border-[var(--border)]/15">
											Balance: {activePoint.balance}
										</span>
									</div>
								</div>
							)}
						</div>

						{/* Individual Mutations Log List */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<h4 className="font-bold text-sm text-[var(--text)] flex items-center gap-2">
									<History size={16} className="text-[var(--accent)]" />
									Booking Timeline ({filteredData.mutations.length})
								</h4>
								<span className="text-xs text-[var(--text-muted)]">Most recent first</span>
							</div>

							<div className="divide-y divide-[var(--border)]/10 bg-[var(--foreground)] border border-[var(--border)]/15 rounded-2xl overflow-hidden shadow-sm">
								{filteredData.mutations.map((m) => {
									const isIn = m.quantity > 0;

									return (
										<div key={m.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--background)]/60 transition-colors">
											{/* Left: Date, Time & Submitter */}
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<p className="font-semibold text-xs sm:text-sm text-[var(--text)]">{m.formattedDate}</p>
													<span className="text-xs font-mono text-[var(--text-muted)]">({m.time})</span>
												</div>
												<div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--text-muted)]">
													<span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-bold text-[9px]">
														{m.initials}
													</span>
													<span>{m.userName}</span>
												</div>
											</div>

											{/* Right: Quantity Pill, Balance & Log Link */}
											<div className="flex items-center gap-2 sm:gap-3 shrink-0">
												<div className="text-right">
													<span
														className={`inline-block px-2.5 py-1 rounded-xl text-xs sm:text-sm font-bold font-mono ${
															isIn
																? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
																: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
														}`}
													>
														{isIn ? `+${m.quantity}` : m.quantity}
													</span>
													<p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">Balance: {m.balanceAfter}</p>
												</div>

												{/* Link to Batch Log */}
												<Link
													href={`/dashboard/stock/logs/${m.logId}`}
													className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--background)] transition-colors"
													title="View full mutation batch"
												>
													<FileText size={16} />
												</Link>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</>
				)}

				{/* Close Button */}
				<div className="flex justify-end pt-2 border-t border-[var(--border)]/10">
					<Button variant="secondary" onClick={onClose}>
						Close
					</Button>
				</div>
			</div>
		</Modal>
	);
}
