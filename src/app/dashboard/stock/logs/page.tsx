import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { History, ArrowLeft, ScanBarcode } from 'lucide-react';
import Link from 'next/link';
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getUsers } from '@/lib/users';
import { getAllCachedArticles } from '@/lib/eandb';
import LogsClient, { LogSummaryItem } from './LogsClient';

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

	const [users, articlesMap] = await Promise.all([getUsers(), getAllCachedArticles()]);
	const userInitialsMap: Record<string, string> = {};
	for (const u of users) {
		if (u.name) {
			userInitialsMap[getInitials(u.name)] = u.name;
		}
	}

	const dir = path.join(process.cwd(), 'data', 'stock');
	let files: string[] = [];
	const logSummaries: LogSummaryItem[] = [];

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
			let totalIn = 0;
			let totalOut = 0;
			let hasPositive = false;
			let hasNegative = false;
			let project: string | undefined;
			let note: string | undefined;
			const itemsPreview: LogSummaryItem['itemsPreview'] = [];

			try {
				const content = await fs.readFile(path.join(dir, file), 'utf-8');
				const payload: Record<string, any> = JSON.parse(content);
				if (payload._meta) {
					project = payload._meta.project;
					note = payload._meta.note;
				}
				const entries = Object.entries(payload).filter(([k, v]) => k !== '_meta' && typeof v === 'number');
				articleCount = entries.length;
				for (const [barcode, qty] of entries) {
					if (typeof qty === 'number') {
						totalMutations += Math.abs(qty);
						if (qty > 0) {
							hasPositive = true;
							totalIn += qty;
						}
						if (qty < 0) {
							hasNegative = true;
							totalOut += Math.abs(qty);
						}
						const art = articlesMap[barcode];
						itemsPreview.push({
							barcode,
							title: art?.title || barcode,
							brand: art?.brand,
							quantity: qty,
						});
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
				totalIn,
				totalOut,
				hasPositive,
				hasNegative,
				project,
				note,
				itemsPreview,
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

			<PageHeader icon={<History size={24} />} title="History Logs" description="Search and filter recorded stock mutations across technicians, projects, and articles" />

			<LogsClient logs={logSummaries} totalArticlesMutated={totalArticlesMutated} />
		</div>
	);
}
