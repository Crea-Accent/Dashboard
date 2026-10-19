/** @format */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Folder, ArrowRight, Compass, Barcode, X, CornerDownLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';

const NAV_ITEMS: { name: string; subtitle: string; href: string; permission?: string }[] = [
	{ name: 'Home Dashboard', subtitle: 'Navigation', href: '/dashboard' },
	{ name: 'Stock Overview & Min/Max', subtitle: 'Stock & Inventory', href: '/dashboard/stock/overview', permission: 'stock.read' },
	{ name: 'Scan & Mutate Stock', subtitle: 'Stock & Inventory', href: '/dashboard/stock/mutate', permission: 'stock.write' },
	{ name: 'Stock Logs & History', subtitle: 'Stock & Inventory', href: '/dashboard/stock/logs', permission: 'stock.read' },
	{ name: 'Tasks', subtitle: 'Navigation', href: '/dashboard/tasks', permission: 'tasks.read' },
	{ name: 'Projects', subtitle: 'Navigation', href: '/dashboard/projects', permission: 'projects.read' },
	{ name: 'Files', subtitle: 'Navigation', href: '/dashboard/files', permission: 'files.read' },
	{ name: 'Templates', subtitle: 'Navigation', href: '/dashboard/templates', permission: 'templates.read' },
	{ name: 'Procedures', subtitle: 'Navigation', href: '/dashboard/procedures', permission: 'projects.read' },
	{ name: 'Apps', subtitle: 'Navigation', href: '/dashboard/apps', permission: 'applications.read' },
	{ name: 'Passwords', subtitle: 'Navigation', href: '/dashboard/passwords', permission: 'passwords.read' },
	{ name: 'Workspace', subtitle: 'Navigation', href: '/dashboard/workspace', permission: 'files.read' },
	{ name: 'Events', subtitle: 'Navigation', href: '/dashboard/events', permission: 'events.read' },
	{ name: 'Settings', subtitle: 'Administration', href: '/settings', permission: 'admin.read' },
];

type QuickProject = {
	name: string;
	city?: string;
	street?: string;
};

type QuickStock = {
	barcode: string;
	title: string;
	brand?: string;
	quantity: number;
};

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
	const router = useRouter();
	const { data: session } = useSession();
	const [query, setQuery] = useState('');
	const [projects, setProjects] = useState<QuickProject[]>([]);
	const [stockItems, setStockItems] = useState<QuickStock[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const permissions = session?.user?.permissions ?? [];

	// Fetch projects and stock items once when opened
	useEffect(() => {
		if (!open) {
			setQuery('');
			setSelectedIndex(0);
			return;
		}

		setTimeout(() => inputRef.current?.focus(), 30);

		fetch('/api/projects/map')
			.then((r) => (r.ok ? r.json() : []))
			.then((data) => {
				if (Array.isArray(data)) {
					setProjects(
						data.map((p: any) => ({
							name: p.name,
							city: p.address?.city,
							street: p.address?.street,
						}))
					);
				}
			})
			.catch(() => {});

		fetch('/api/stock/overview')
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (data?.items && Array.isArray(data.items)) {
					setStockItems(
						data.items.map((item: any) => ({
							barcode: item.barcode,
							title: item.title || item.barcode,
							brand: item.brand,
							quantity: item.quantity,
						}))
					);
				}
			})
			.catch(() => {});
	}, [open]);

	if (!open) return null;

	const q = query.toLowerCase().trim();

	// 1. Navigation items
	const navResults = NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission))
		.filter((item) => !q || item.name.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
		.map((item) => ({
			type: 'nav' as const,
			id: `nav-${item.href}`,
			title: item.name,
			subtitle: item.subtitle,
			href: item.href,
		}))
		.slice(0, q ? 5 : 6);

	// 2. Project items
	const projectResults = q
		? projects
				.filter((p) => p.name.toLowerCase().includes(q) || (p.city && p.city.toLowerCase().includes(q)) || (p.street && p.street.toLowerCase().includes(q)))
				.slice(0, 5)
				.map((p) => ({
					type: 'project' as const,
					id: `proj-${p.name}`,
					title: p.name,
					subtitle: [p.street, p.city].filter(Boolean).join(', ') || 'Project',
					href: `/dashboard/projects/${encodeURIComponent(p.name)}`,
				}))
		: [];

	// 3. Stock items
	const stockResults = q
		? stockItems
				.filter((s) => s.title.toLowerCase().includes(q) || s.barcode.toLowerCase().includes(q) || (s.brand && s.brand.toLowerCase().includes(q)))
				.slice(0, 5)
				.map((s) => ({
					type: 'stock' as const,
					id: `stock-${s.barcode}`,
					title: s.title,
					subtitle: `${s.brand ? s.brand + ' • ' : ''}${s.barcode} (Stock: ${s.quantity > 0 ? '+' + s.quantity : s.quantity})`,
					href: `/dashboard/stock/overview`,
				}))
		: [];

	const allResults = [...navResults, ...projectResults, ...stockResults];
	const clampedIndex = Math.min(selectedIndex, Math.max(0, allResults.length - 1));

	const handleSelect = (href: string) => {
		onClose();
		router.push(href);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setSelectedIndex((prev) => (prev + 1) % Math.max(1, allResults.length));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setSelectedIndex((prev) => (prev - 1 + Math.max(1, allResults.length)) % Math.max(1, allResults.length));
		} else if (e.key === 'Enter' && allResults[clampedIndex]) {
			e.preventDefault();
			handleSelect(allResults[clampedIndex].href);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	};

	return (
		<div className="fixed inset-0 z-100000 flex items-start justify-center pt-[12vh] px-4 bg-black/50 backdrop-blur-xs" onClick={onClose}>
			<div
				className="w-full max-w-xl bg-[var(--foreground)] border border-[var(--border)]/20 rounded-2xl shadow-2xl overflow-hidden"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={handleKeyDown}
			>
				{/* Search Input Bar */}
				<div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]/15 bg-[var(--background)]">
					<Search size={18} className="text-[var(--accent)] shrink-0" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						placeholder="Search pages, projects, or stock articles (barcode / name)..."
						className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
					/>
					{query && (
						<button onClick={() => setQuery('')} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
							<X size={15} />
						</button>
					)}
					<kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--foreground)] text-[var(--text-muted)] border border-[var(--border)]/20">ESC</kbd>
				</div>

				{/* Results List */}
				<div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
					{allResults.length === 0 ? (
						<div className="py-10 text-center text-sm text-[var(--text-muted)]">No matching pages, projects, or stock articles found.</div>
					) : (
						allResults.map((item, idx) => {
							const active = idx === clampedIndex;
							return (
								<button
									key={item.id}
									type="button"
									onClick={() => handleSelect(item.href)}
									onMouseEnter={() => setSelectedIndex(idx)}
									className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
										active ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--background)] text-[var(--text)]'
									}`}
								>
									<div className="flex items-center gap-3 min-w-0">
										<div
											className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
												active ? 'bg-white/20 text-white' : 'bg-[var(--background)] text-[var(--accent)] border border-[var(--border)]/10'
											}`}
										>
											{item.type === 'nav' ? <Compass size={16} /> : item.type === 'project' ? <Folder size={16} /> : <Barcode size={16} />}
										</div>
										<div className="min-w-0">
											<p className="text-sm font-semibold truncate">{item.title}</p>
											<p className={`text-xs truncate ${active ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{item.subtitle}</p>
										</div>
									</div>

									<div className="flex items-center gap-1.5 shrink-0">
										<span
											className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md ${
												active ? 'bg-white/20 text-white' : 'bg-[var(--background)] text-[var(--text-muted)]'
											}`}
										>
											{item.type === 'nav' ? 'Page' : item.type === 'project' ? 'Project' : 'Stock'}
										</span>
										<ArrowRight size={14} className={active ? 'text-white' : 'text-[var(--text-muted)] opacity-50'} />
									</div>
								</button>
							);
						})
					)}
				</div>

				{/* Footer Hint */}
				<div className="px-4 py-2 bg-[var(--background)] border-t border-[var(--border)]/10 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
					<span>Use arrow keys ↑↓ to navigate</span>
					<span className="flex items-center gap-1">
						<CornerDownLeft size={12} /> Enter to open
					</span>
				</div>
			</div>
		</div>
	);
}
