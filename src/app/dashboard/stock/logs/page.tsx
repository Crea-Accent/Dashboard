import PageHeader from '@/components/ui/PageHeader';
import { History, ArrowLeft, FileJson, ChevronRight } from 'lucide-react';
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

export default async function StockLogsPage() {
	const session = await getServerSession(authConfig);
	const permissions = session?.user?.permissions || [];
	const hasWrite = permissions.includes('stock.write') || permissions.includes('admin.write');

	if (!hasWrite) {
		return (
			<div className="p-10 flex flex-col items-center justify-center text-center space-y-3">
				<div className="text-lg font-semibold">Access denied</div>
				<p className="text-sm text-zinc-500">You need stock.write permissions to view history logs.</p>
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
	try {
		files = await fs.readdir(dir);
		files = files.filter((f) => f.endsWith('.json')).sort((a, b) => b.localeCompare(a));
	} catch (e) {
		// Directory might not exist yet
	}

	return (
		<div className="space-y-6 pt-6 max-w-4xl mx-auto">
			<div className="flex items-center mb-4">
				<Link href="/dashboard/stock" className="p-3 bg-[var(--foreground)] hover:bg-[var(--border)] rounded-full transition-colors shadow-sm text-[var(--text)]">
					<ArrowLeft size={24} />
				</Link>
			</div>

			<PageHeader icon={<History size={24} />} title="Stock Logs" description="History of recent stock mutations" />

			{files.length === 0 ? (
				<div className="flex items-center justify-center border-2 border-dashed border-[var(--border)]/10 rounded-2xl bg-[var(--background)] min-h-[400px]">
					<p className="text-[var(--text-muted)] text-center">No stock logs found yet.</p>
				</div>
			) : (
				<div className="bg-[var(--background)] border border-[var(--border)]/10 rounded-2xl overflow-hidden shadow-sm divide-y divide-[var(--border)]/10">
					{files.map((file) => {
						const basename = file.replace('.json', '');
						const parts = basename.split('_');
						const date = parts[0] || '';
						const time = (parts[1] || '').replace(/-/g, ':');
						const initials = parts[2] || '??';
						const submitterName = userInitialsMap[initials] || initials;

						return (
							<Link key={file} href={`/dashboard/stock/logs/${basename}`} className="flex items-center justify-between p-4 hover:bg-[var(--foreground)] transition-colors group">
								<div className="flex items-center gap-4">
									<div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
										<FileJson size={20} />
									</div>
									<div>
										<p className="font-semibold text-[var(--text)]">
											{date} at {time}
										</p>
										<p className="text-sm text-[var(--text-muted)]">Submitted by {submitterName}</p>
									</div>
								</div>
								<ChevronRight className="text-[var(--text-muted)] group-hover:text-blue-500 transition-colors" />
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
