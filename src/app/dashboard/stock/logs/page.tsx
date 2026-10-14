import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { History, ArrowLeft, FileJson, ChevronRight, ScanBarcode, User, Calendar, Package } from 'lucide-react';
import Link from 'next/link';
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getUsers } from '@/lib/users';

function getInitials(name: string) {
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase();
}

function formatLogDate(dateStr: string, timeStr: string) {
	try {
		const [year, month, day] = dateStr.split('-');
		const time = timeStr.replace(/-/g, ':');
		if (!year || !month || !day) return `${dateStr} ${time}`;

		const dateObj = new Date(`${dateStr}T${time}`);
		if (isNaN(dateObj.getTime())) return `${dateStr} at ${time}`;

		return (
			dateObj.toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
			}) + ` at ${time}`
		);
	} catch {
		return `${dateStr} ${timeStr.replace(/-/g, ':')}`;
	}
}

export default async function StockLogsPage() {
	const session = await getServerSession(authConfig);
	const permissions = session?.user?.permissions || [];
	const hasWrite = permissions.includes('stock.write') || permissions.includes('admin.write');

	if (!hasWrite) {
		return (
			<div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto">
				<div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
					<History size={24} />
				</div>
				<div className="text-lg font-semibold text-[var(--text)]">Access Denied</div>
				<p className="text-sm text-[var(--text-muted)]">You need stock.write permissions to view history logs.</p>
				<Link href="/dashboard/stock">
					<Button variant="secondary" icon={<ArrowLeft size={16} />}>
						Back to Stock
					</Button>
				</Link>
			</div>
		);
	}

	const users = await getUsers();
	const userInitialsMap: Record<string, string> = {};
	for (const u of users) {
		if (u.name) {
			userInitialsMap[getInitials(u.name)] = u.name;
		}
	}

	const dir = path.join(process.cwd(), 'data', 'stock');
	let files: string[] = [];
	const logSummaries: Array<{
		file: string;
		basename: string;
		date: string;
		time: string;
		formattedDate: string;
		initials: string;
		submitterName: string;
		articleCount: number;
		totalMutations: number;
		hasPositive: boolean;
		hasNegative: boolean;
	}> = [];

	try {
		const rawFiles = await fs.readdir(dir);
		files = rawFiles.filter((f) => f.endsWith('.json')).sort((a, b) => b.localeCompare(a));

		for (const file of files) {
			const basename = file.replace('.json', '');
			const parts = basename.split('_');
			const date = parts[0] || '';
			const time = (parts[1] || '').replace(/-/g, ':');
			const initials = parts[2] || '??';
			const submitterName = userInitialsMap[initials] || initials;

			let articleCount = 0;
			let totalMutations = 0;
			let hasPositive = false;
			let hasNegative = false;

			try {
				const content = await fs.readFile(path.join(dir, file), 'utf-8');
				const payload: Record<string, number> = JSON.parse(content);
				const entries = Object.entries(payload);
				articleCount = entries.length;
				for (const [, qty] of entries) {
					if (typeof qty === 'number') {
						totalMutations += Math.abs(qty);
						if (qty > 0) hasPositive = true;
						if (qty < 0) hasNegative = true;
					}
				}
			} catch {}

			logSummaries.push({
				file,
				basename,
				date,
				time,
				formattedDate: formatLogDate(date, time),
				initials,
				submitterName,
				articleCount,
				totalMutations,
				hasPositive,
				hasNegative,
			});
		}
	} catch (e) {
		// Directory might not exist yet
	}

	const totalArticlesMutated = logSummaries.reduce((sum, l) => sum + l.totalMutations, 0);

	return (
		<div className="space-y-6 pt-4 sm:pt-6 max-w-4xl mx-auto px-4 md:px-0">
			{/* Top Header Actions */}
			<div className="flex items-center justify-between gap-3">
				<Link
					href="/dashboard/stock"
					className="p-2.5 sm:p-3 bg-[var(--foreground)] hover:bg-[var(--border)]/20 rounded-full transition-colors shadow-sm text-[var(--text)] shrink-0"
					title="Back to Stock"
				>
					<ArrowLeft size={20} className="sm:w-6 sm:h-6" />
				</Link>

				<Link href="/dashboard/stock/mutate">
					<Button icon={<ScanBarcode size={16} />}>
						<span className="hidden sm:inline">New Mutation</span>
						<span className="sm:hidden">Mutate</span>
					</Button>
				</Link>
			</div>

			<PageHeader icon={<History size={24} />} title="History Logs" description="Chronological overview of all recorded stock mutations" />

			{/* Quick Summary Stats Bar */}
			{logSummaries.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
					<Card className="p-3.5 sm:p-4 flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
							<FileJson size={20} />
						</div>
						<div className="min-w-0">
							<p className="text-xs text-[var(--text-muted)] font-medium">Mutation Logs</p>
							<p className="text-lg sm:text-xl font-bold text-[var(--text)] truncate">{logSummaries.length}</p>
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
							<p className="text-xs sm:text-sm font-semibold text-[var(--text)] truncate">{logSummaries[0]?.date || '-'}</p>
						</div>
					</Card>
				</div>
			)}

			{/* Logs List */}
			{logSummaries.length === 0 ? (
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
			) : (
				<div className="bg-[var(--background)] border border-[var(--border)]/10 rounded-2xl overflow-hidden shadow-sm divide-y divide-[var(--border)]/10">
					{logSummaries.map((log) => (
						<Link
							key={log.file}
							href={`/dashboard/stock/logs/${log.basename}`}
							className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-[var(--foreground)]/60 transition-colors group gap-3"
						>
							<div className="flex items-center gap-3 sm:gap-4 min-w-0">
								<div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
									<FileJson size={20} />
								</div>
								<div className="min-w-0">
									<p className="font-semibold text-sm sm:text-base text-[var(--text)] truncate group-hover:text-blue-500 transition-colors">{log.formattedDate}</p>
									<div className="flex flex-wrap items-center gap-2 mt-1">
										<span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
											<User size={12} /> {log.submitterName}
										</span>
										<span className="text-xs px-2 py-0.5 rounded-full bg-[var(--foreground)] border border-[var(--border)]/10 text-[var(--text-muted)] font-medium">
											{log.articleCount} {log.articleCount === 1 ? 'item' : 'items'}
										</span>
									</div>
								</div>
							</div>

							<div className="flex items-center gap-2 shrink-0">
								<ChevronRight size={18} className="text-[var(--text-muted)] group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
