import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { FileJson, ArrowLeft, User, Calendar, Plus, Minus, Tag, ScanBarcode, Package } from 'lucide-react';
import Link from 'next/link';
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getUsers } from '@/lib/users';
import { getArticles } from '@/lib/eandb';

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
		if (isNaN(dateObj.getTime())) return `${dateStr} om ${time}`;

		return (
			dateObj.toLocaleDateString('nl-BE', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			}) + ` om ${time}`
		);
	} catch {
		return `${dateStr} ${timeStr.replace(/-/g, ':')}`;
	}
}

export default async function StockLogDetailPage(props: { params: Promise<{ id: string }> }) {
	const session = await getServerSession(authConfig);
	const permissions = session?.user?.permissions || [];
	const hasWrite = permissions.includes('stock.write') || permissions.includes('admin.write');

	if (!hasWrite) {
		return (
			<div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto">
				<div className="text-lg font-semibold text-[var(--text)]">Geen toegang</div>
				<p className="text-sm text-[var(--text-muted)]">U heeft stock.write rechten nodig om deze log te bekijken.</p>
				<Link href="/dashboard/stock/logs">
					<Button variant="secondary" icon={<ArrowLeft size={16} />}>
						Terug naar Logs
					</Button>
				</Link>
			</div>
		);
	}

	const params = await props.params;
	const id = params.id;
	const filename = `${id}.json`;
	const filepath = path.join(process.cwd(), 'data', 'stock', filename);

	let payload: Record<string, number> | null = null;
	try {
		const content = await fs.readFile(filepath, 'utf-8');
		payload = JSON.parse(content);
	} catch (e) {
		// file not found or invalid
	}

	const barcodes = payload ? Object.keys(payload) : [];
	const articles = barcodes.length > 0 ? await getArticles(barcodes) : {};

	const parts = id.split('_');
	const date = parts[0] || '';
	const time = (parts[1] || '').replace(/-/g, ':');
	const initials = parts[2] || '??';
	const formattedDate = formatLogDate(date, time);

	const users = await getUsers();
	let submitterName = initials;
	for (const u of users) {
		if (u.name && getInitials(u.name) === initials) {
			submitterName = u.name;
			break;
		}
	}

	// Calculate mutation stats
	const entries = payload ? Object.entries(payload) : [];
	const totalAdded = entries.filter(([, q]) => q > 0).reduce((sum, [, q]) => sum + q, 0);
	const totalRemoved = entries.filter(([, q]) => q < 0).reduce((sum, [, q]) => sum + Math.abs(q), 0);

	return (
		<div className="space-y-6 pt-4 sm:pt-6 max-w-4xl mx-auto px-4 md:px-0">
			{/* Top Header Actions */}
			<div className="flex items-center justify-between gap-3">
				<Link
					href="/dashboard/stock/logs"
					className="p-2.5 sm:p-3 bg-[var(--foreground)] hover:bg-[var(--border)]/20 rounded-full transition-colors shadow-sm text-[var(--text)] shrink-0"
					title="Terug naar overzicht"
				>
					<ArrowLeft size={20} className="sm:w-6 sm:h-6" />
				</Link>

				<Link href="/dashboard/stock/mutate">
					<Button icon={<ScanBarcode size={16} />}>
						<span className="hidden sm:inline">Nieuwe Mutatie</span>
						<span className="sm:hidden">Muteren</span>
					</Button>
				</Link>
			</div>

			<PageHeader icon={<FileJson size={24} />} title={`Log: ${formattedDate}`} description={`Geboekt door ${submitterName} (${initials})`} />

			{!payload ? (
				<div className="flex flex-col items-center justify-center border-2 border-dashed border-red-500/20 rounded-2xl bg-[var(--background)] p-8 sm:p-12 text-center space-y-3">
					<p className="text-red-500 font-semibold">Logbestand niet gevonden of beschadigd.</p>
					<Link href="/dashboard/stock/logs">
						<Button variant="secondary" icon={<ArrowLeft size={16} />}>
							Terug naar overzicht
						</Button>
					</Link>
				</div>
			) : (
				<>
					{/* Stat Metrics Bar */}
					<div className="grid grid-cols-3 gap-2.5 sm:gap-4">
						<Card className="p-3 sm:p-4 text-center">
							<p className="text-[11px] sm:text-xs text-[var(--text-muted)] font-medium">Artikelen</p>
							<p className="text-lg sm:text-2xl font-bold text-[var(--text)] mt-0.5">{entries.length}</p>
						</Card>

						<Card className="p-3 sm:p-4 text-center">
							<p className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium">Bijgeboekt</p>
							<p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+{totalAdded}</p>
						</Card>

						<Card className="p-3 sm:p-4 text-center">
							<p className="text-[11px] sm:text-xs text-red-500 font-medium">Afgeboekt</p>
							<p className="text-lg sm:text-2xl font-bold text-red-500 mt-0.5">-{totalRemoved}</p>
						</Card>
					</div>

					{/* Mutation Items Card */}
					<div className="bg-[var(--background)] border border-[var(--border)]/10 rounded-2xl overflow-hidden shadow-sm">
						<div className="grid grid-cols-[1fr_auto] bg-[var(--foreground)] px-4 py-3 border-b border-[var(--border)]/10 font-medium text-[var(--text-muted)] text-xs sm:text-sm">
							<div>Artikel & Barcode</div>
							<div className="text-right">Mutatie</div>
						</div>

						<div className="divide-y divide-[var(--border)]/10">
							{entries.map(([code, quantity]) => {
								const article = articles[code];
								const isPositive = quantity > 0;
								const isNegative = quantity < 0;
								const hasTitle = Boolean(article?.title && article.title !== code);

								return (
									<div key={code} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[var(--foreground)]/40 transition-colors">
										<div className="min-w-0 flex-1">
											{hasTitle ? (
												<>
													<p className="font-semibold text-sm sm:text-base text-[var(--text)] leading-snug line-clamp-2 sm:truncate">{article.title}</p>
													<div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
														{article.brand && (
															<span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
																{article.brand}
															</span>
														)}
														<span className="font-mono text-[11px] sm:text-xs text-[var(--text-muted)]">{code}</span>
													</div>
												</>
											) : (
												<p className="font-mono font-semibold text-sm sm:text-base text-[var(--text)]">{code}</p>
											)}
										</div>

										<div className="shrink-0">
											<div
												className={`px-3 py-1.5 rounded-xl font-bold text-sm min-w-[3.5rem] text-center ${
													isPositive
														? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
														: isNegative
															? 'bg-red-500/10 text-red-500 border border-red-500/20'
															: 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
												}`}
											>
												{isPositive ? `+${quantity}` : quantity}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</>
			)}
		</div>
	);
}
