import PageHeader from '@/components/ui/PageHeader';
import { PackageSearch, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function StockOverviewPage() {
	return (
		<div className="space-y-6 pt-6">
			<div className="flex items-center mb-4">
				<Link href="/dashboard/stock" className="p-3 bg-[var(--foreground)] hover:bg-[var(--border)] rounded-full transition-colors shadow-sm text-[var(--text)]">
					<ArrowLeft size={24} />
				</Link>
			</div>

			<PageHeader icon={<PackageSearch size={24} />} title="Stock Overview" description="List of all articles and current stock levels" />

			<div className="flex items-center justify-center border-2 border-dashed border-[var(--border)]/10 rounded-2xl bg-[var(--background)] min-h-[400px]">
				<p className="text-[var(--text-muted)] text-center">Waiting for CAFCA integration to load article list...</p>
			</div>
		</div>
	);
}
