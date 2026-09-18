import PageHeader from '@/components/ui/PageHeader';
import { FileJson, ArrowLeft } from 'lucide-react';
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

export default async function StockLogDetailPage(props: { params: Promise<{ id: string }> }) {
	const session = await getServerSession(authConfig);
	const permissions = session?.user?.permissions || [];
	const hasWrite = permissions.includes('stock.write') || permissions.includes('admin.write');

	if (!hasWrite) {
		return (
			<div className="p-10 flex flex-col items-center justify-center text-center space-y-3">
				<div className="text-lg font-semibold">Access denied</div>
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

	const parts = id.split('_');
	const date = parts[0] || '';
	const time = (parts[1] || '').replace(/-/g, ':');
	const initials = parts[2] || '??';

	const users = await getUsers();
	let submitterName = initials;
	for (const u of users) {
		if (u.name && getInitials(u.name) === initials) {
			submitterName = u.name;
			break;
		}
	}

	return (
		<div className="space-y-6 pt-6 max-w-4xl mx-auto">
			<div className="flex items-center mb-4">
				<Link href="/dashboard/stock/logs" className="p-3 bg-[var(--foreground)] hover:bg-[var(--border)] rounded-full transition-colors shadow-sm text-[var(--text)]">
					<ArrowLeft size={24} />
				</Link>
			</div>

			<PageHeader icon={<FileJson size={24} />} title={`Log: ${date} ${time}`} description={`Submitted by ${submitterName}`} />

			{!payload ? (
				<div className="flex items-center justify-center border-2 border-dashed border-red-500/20 rounded-2xl bg-[var(--background)] min-h-[300px]">
					<p className="text-red-500 text-center">Log file not found or corrupted.</p>
				</div>
			) : (
				<div className="bg-[var(--background)] border border-[var(--border)]/10 rounded-2xl overflow-hidden shadow-sm">
					<div className="grid grid-cols-2 bg-[var(--foreground)] p-4 border-b border-[var(--border)]/10 font-medium text-[var(--text-muted)] text-sm">
						<div>Barcode</div>
						<div className="text-right">Mutatie</div>
					</div>
					<div className="divide-y divide-[var(--border)]/10">
						{Object.entries(payload).map(([code, quantity]) => {
							const isPositive = quantity > 0;
							const isNegative = quantity < 0;

							return (
								<div key={code} className="grid grid-cols-2 p-4 items-center">
									<div className="font-mono font-semibold">{code}</div>
									<div className={`text-right font-bold text-lg ${isPositive ? 'text-[var(--accent)]' : isNegative ? 'text-red-500' : 'text-[var(--text)]'}`}>
										{isPositive ? `+${quantity}` : quantity}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
