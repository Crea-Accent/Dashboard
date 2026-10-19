/** @format */
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { History, FileJson, ChevronRight, ScanBarcode, User, Calendar, Package, FolderKanban, Search, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';

export type LogSummaryItem = {
	file: string;
	basename: string;
	date: string;
	time: string;
	formattedDate: string;
	initials: string;
	submitterName: string;
	articleCount: number;
	totalMutations: number;
	totalIn: number;
	totalOut: number;
	hasPositive: boolean;
	hasNegative: boolean;
	project?: string;
	note?: string;
	itemsPreview: {
		barcode: string;
		title: string;
		brand?: string;
		quantity: number;
	}[];
};

export default function LogsClient({ logs, totalArticlesMutated }: { logs: LogSummaryItem[]; totalArticlesMutated: number }) {
	const [search, setSearch] = useState('');
	const [userFilter, setUserFilter] = useState('');
	const [projectFilter, setProjectFilter] = useState('');
	const [flowFilter, setFlowFilter] = useState<'all' | 'in' | 'out'>('all');

	const uniqueUsers = useMemo(() => {
		const s = new Set(logs.map((l) => l.submitterName).filter(Boolean));
		return Array.from(s).sort();
	}, [logs]);

	const uniqueProjects = useMemo(() => {
		const s = new Set(logs.map((l) => l.project).filter(Boolean) as string[]);
		return Array.from(s).sort();
	}, [logs]);

	const filteredLogs = useMemo(() => {
		const q = search.toLowerCase().trim();
		return logs.filter((l) => {
			if (userFilter && l.submitterName !== userFilter) return false;
			if (projectFilter) {
				if (projectFilter === '__none__' && l.project) return false;
				if (projectFilter !== '__none__' && l.project !== projectFilter) return false;
			}
			if (flowFilter === 'in' && !l.hasPositive) return false;
			if (flowFilter === 'out' && !l.hasNegative) return false;

			if (q) {
				const matchesMeta =
					l.formattedDate.toLowerCase().includes(q) ||
					l.date.toLowerCase().includes(q) ||
					l.submitterName.toLowerCase().includes(q) ||
					l.initials.toLowerCase().includes(q) ||
					(l.project && l.project.toLowerCase().includes(q)) ||
					(l.note && l.note.toLowerCase().includes(q));

				const matchesItem = l.itemsPreview.some((it) => it.barcode.toLowerCase().includes(q) || it.title.toLowerCase().includes(q) || (it.brand && it.brand.toLowerCase().includes(q)));

				if (!matchesMeta && !matchesItem) return false;
			}

			return true;
		});
	}, [logs, search, userFilter, projectFilter, flowFilter]);

	const hasActiveFilters = Boolean(search || userFilter || projectFilter || flowFilter !== 'all');

	if (logs.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)]/10 rounded-2xl bg-[var(--background)] p-8 sm:p-12 min-h-[300px] text-center space-y-3">
				<div className="h-12 w-12 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--text-muted)]">
					<History size={24} />
				</div>
				<p className="font-semibold text-[var(--text)]">No mutations logged yet</p>
				<p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm">When you book items via Scan & Mutate, transactions are automatically recorded here.</p>
				<Link href="/dashboard/stock/mutate" className="pt-2">
					<Button icon={<ScanBarcode size={16} />}>Book first mutation</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			{/* Quick Summary Stats Bar */}
			<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
				<Card className="p-3.5 sm:p-4 flex items-center gap-3">
					<div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
						<FileJson size={20} />
					</div>
					<div className="min-w-0">
						<p className="text-xs text-[var(--text-muted)] font-medium">Mutation Logs</p>
						<p className="text-lg sm:text-xl font-bold text-[var(--text)] truncate">
							{filteredLogs.length}
							{hasActiveFilters && <span className="text-xs font-normal text-[var(--text-muted)]"> / {logs.length}</span>}
						</p>
					</div>
				</Card>

				<Card className="p-3.5 sm:p-4 flex items-center gap-3">
					<div className="h-10 w-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
						<Package size={20} />
					</div>
					<div className="min-w-0">
						<p className="text-xs text-[var(--text-muted)] font-medium">Mutated Units</p>
						<p className="text-lg sm:text-xl font-bold text-[var(--text)] truncate">{totalArticlesMutated}</p>
					</div>
				</Card>

				<Card className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 flex items-center gap-3">
					<div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
						<Calendar size={20} />
					</div>
					<div className="min-w-0">
						<p className="text-xs text-[var(--text-muted)] font-medium">Latest Mutation</p>
						<p className="text-xs sm:text-sm font-semibold text-[var(--text)] truncate">{logs[0]?.date || '-'}</p>
					</div>
				</Card>
			</div>

			{/* Interactive Search & Filter Bar */}
			<div className="p-3.5 bg-[var(--foreground)] rounded-2xl border border-[var(--border)]/15 space-y-3">
				<div className="flex flex-col sm:flex-row gap-2.5">
					<div className="relative flex-1">
						<Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search logs by article name, barcode, project, note, or technician..."
							className="w-full h-10 pl-10 pr-9 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
						/>
						{search && (
							<button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]">
								<X size={14} />
							</button>
						)}
					</div>

					{/* Flow Type Filter */}
					<div className="flex p-1 bg-[var(--background)] rounded-xl border border-[var(--border)]/15 shrink-0">
						<button
							onClick={() => setFlowFilter('all')}
							className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
								flowFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
							}`}
						>
							All
						</button>
						<button
							onClick={() => setFlowFilter('in')}
							className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
								flowFilter === 'in' ? 'bg-emerald-600 text-white' : 'text-emerald-600 dark:text-emerald-400 hover:text-[var(--text)]'
							}`}
						>
							<ArrowUpRight size={12} /> +In
						</button>
						<button
							onClick={() => setFlowFilter('out')}
							className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
								flowFilter === 'out' ? 'bg-rose-600 text-white' : 'text-rose-500 hover:text-[var(--text)]'
							}`}
						>
							<ArrowDownRight size={12} /> -Out
						</button>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2.5">
					<select
						value={userFilter}
						onChange={(e) => setUserFilter(e.target.value)}
						className="h-9 px-3 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
					>
						<option value="">All Technicians ({uniqueUsers.length})</option>
						{uniqueUsers.map((u) => (
							<option key={u} value={u}>
								{u}
							</option>
						))}
					</select>

					<select
						value={projectFilter}
						onChange={(e) => setProjectFilter(e.target.value)}
						className="h-9 px-3 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
					>
						<option value="">All Projects ({uniqueProjects.length})</option>
						<option value="__none__">General Stock (No project)</option>
						{uniqueProjects.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</select>

					{hasActiveFilters && (
						<button
							onClick={() => {
								setSearch('');
								setUserFilter('');
								setProjectFilter('');
								setFlowFilter('all');
							}}
							className="text-xs text-[var(--accent)] hover:underline ml-auto font-medium"
						>
							Reset filters
						</button>
					)}
				</div>
			</div>

			{/* Filtered Logs List */}
			{filteredLogs.length === 0 ? (
				<div className="p-10 text-center border-2 border-dashed border-[var(--border)]/15 rounded-2xl text-sm text-[var(--text-muted)]">
					No stock logs match your search or filter criteria.
				</div>
			) : (
				<div className="bg-[var(--background)] border border-[var(--border)]/10 rounded-2xl overflow-hidden shadow-sm divide-y divide-[var(--border)]/10">
					{filteredLogs.map((log) => (
						<Link
							key={log.file}
							href={`/dashboard/stock/logs/${log.basename}`}
							className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 hover:bg-[var(--foreground)]/60 transition-colors group gap-3"
						>
							<div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
								<div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
									<FileJson size={20} />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-semibold text-sm sm:text-base text-[var(--text)] truncate group-hover:text-blue-500 transition-colors">{log.formattedDate}</p>
										{log.project && (
											<span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
												<FolderKanban size={11} />
												{log.project}
											</span>
										)}
										{log.totalIn > 0 && (
											<span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">+{log.totalIn}</span>
										)}
										{log.totalOut > 0 && <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">-{log.totalOut}</span>}
									</div>

									<div className="flex flex-wrap items-center gap-2 mt-1">
										<span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
											<User size={12} /> {log.submitterName}
										</span>
										<span className="text-xs px-2 py-0.5 rounded-full bg-[var(--foreground)] border border-[var(--border)]/10 text-[var(--text-muted)] font-medium">
											{log.articleCount} {log.articleCount === 1 ? 'article' : 'articles'}
										</span>
										{log.note && <span className="text-xs text-[var(--text-muted)] italic truncate max-w-xs">&ldquo;{log.note}&rdquo;</span>}
									</div>

									{/* Article Preview Pills */}
									{log.itemsPreview.length > 0 && (
										<div className="flex flex-wrap gap-1.5 mt-2">
											{log.itemsPreview.slice(0, 4).map((item) => (
												<span
													key={item.barcode}
													className="text-[11px] px-2 py-0.5 rounded-lg bg-[var(--foreground)] border border-[var(--border)]/10 text-[var(--text-muted)] truncate max-w-[220px]"
												>
													<strong className={item.quantity > 0 ? 'text-emerald-500' : 'text-rose-500'}>{item.quantity > 0 ? `+${item.quantity}` : item.quantity}</strong>{' '}
													{item.title}
												</span>
											))}
											{log.itemsPreview.length > 4 && <span className="text-[11px] text-[var(--text-muted)] px-1.5 py-0.5">+{log.itemsPreview.length - 4} more</span>}
										</div>
									)}
								</div>
							</div>

							<div className="hidden sm:flex items-center gap-2 shrink-0">
								<ChevronRight size={18} className="text-[var(--text-muted)] group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
