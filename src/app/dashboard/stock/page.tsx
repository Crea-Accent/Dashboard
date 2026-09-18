import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Link from 'next/link';
import { PackageSearch, ScanBarcode, History, Package } from 'lucide-react';

export default function StockMenuPage() {
	return (
		<div className="space-y-8 max-w-4xl mx-auto pt-6">
			<PageHeader icon={<Package size={24} />} title="Stock Management" description="Manage your inventory, scan items, and view logs" />

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Link href="/dashboard/stock/overview" className="block group">
					<Card className="p-8 h-full flex flex-col items-center justify-center text-center space-y-4 transition-all hover:scale-105 hover:shadow-lg hover:border-[var(--accent)] border-2 border-[var(--border)]/10 cursor-pointer group-hover:bg-[var(--accent)]/5">
						<div className="h-16 w-16 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--accent)] shadow-sm">
							<PackageSearch size={32} />
						</div>
						<div>
							<h3 className="font-bold text-xl text-[var(--text)] mb-2 group-hover:text-[var(--accent)]">Overview</h3>
							<p className="text-[var(--text-muted)] text-sm">View all current stock levels and articles in the system.</p>
						</div>
					</Card>
				</Link>

				<Link href="/dashboard/stock/mutate" className="block group">
					<Card className="p-8 h-full flex flex-col items-center justify-center text-center space-y-4 transition-all hover:scale-105 hover:shadow-lg hover:border-[var(--accent)] border-2 border-[var(--border)]/10 cursor-pointer group-hover:bg-[var(--accent)]/5">
						<div className="h-16 w-16 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--accent)] shadow-sm">
							<ScanBarcode size={32} />
						</div>
						<div>
							<h3 className="font-bold text-xl text-[var(--text)] mb-2 group-hover:text-[var(--accent)]">Scan & Mutate</h3>
							<p className="text-[var(--text-muted)] text-sm">Scan barcodes to quickly add or remove items from stock.</p>
						</div>
					</Card>
				</Link>

				<Link href="/dashboard/stock/logs" className="block group">
					<Card className="p-8 h-full flex flex-col items-center justify-center text-center space-y-4 transition-all hover:scale-105 hover:shadow-lg hover:border-[var(--accent)] border-2 border-[var(--border)]/10 cursor-pointer group-hover:bg-[var(--accent)]/5">
						<div className="h-16 w-16 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--accent)] shadow-sm">
							<History size={32} />
						</div>
						<div>
							<h3 className="font-bold text-xl text-[var(--text)] mb-2 group-hover:text-[var(--accent)]">History Logs</h3>
							<p className="text-[var(--text-muted)] text-sm">View a detailed history of all recent stock mutations.</p>
						</div>
					</Card>
				</Link>
			</div>
		</div>
	);
}
