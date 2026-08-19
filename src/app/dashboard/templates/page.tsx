'use client';
import { FileText, Search, Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import Loading from '@/components/ui/Loading';
import PageHeader from '@/components/ui/PageHeader';
import { NotPermitted } from '@/providers/PermissionsProvider';

type FileEntry = {
	path: string;
	name: string;
	type: string;
};

type TemplateCategory = {
	name: string;
	files: FileEntry[];
};

export default function TemplatesPage() {
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [categories, setCategories] = useState<TemplateCategory[]>([]);

	const load = async () => {
		try {
			const s = await fetch('/api/settings/templates').then((r) => r.json());

			setLoading(true);

			if (!s?.path) {
				setCategories([]);
				return;
			}

			const res = await fetch(`/api/files?view=${encodeURIComponent(s.path)}&recursive=1`);

			if (!res.ok) {
				setCategories([]);
				return;
			}

			const data: FileEntry[] = await res.json();

			const grouped: Record<string, FileEntry[]> = {};

			for (const file of data) {
				if (file.type !== 'file') continue;

				const normalized = file.path.replace(/\\/g, '/');
				const parts = normalized.split('/');

				const category = parts[parts.length - 2] ?? 'Uncategorized';

				if (!grouped[category]) {
					grouped[category] = [];
				}

				grouped[category].push(file);
			}

			const categories = Object.entries(grouped)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([name, files]) => ({
					name,
					files: files.sort((a, b) => a.name.localeCompare(b.name)),
				}));

			setCategories(categories);
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const filteredCategories = useMemo(() => {
		if (!search.trim()) return categories;

		const query = search.toLowerCase();

		return categories
			.map((category) => ({
				...category,
				files: category.files.filter((file) => file.name.toLowerCase().includes(query)),
			}))
			.filter((category) => category.files.length > 0);
	}, [categories, search]);

	const downloadFile = (path: string) => {
		window.open(`/api/files/download?path=${encodeURIComponent(path)}`, '_blank');
	};

	if (loading) return <Loading title="Loading Templates" />;

	return (
		<NotPermitted permission="templates.read">
			<div className="space-y-6">
				<PageHeader icon={<FileText size={20} />} title="Templates" description="Downloadable templates and forms." />

				<Card className="p-4">
					<Input icon={<Search size={16} />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." />
				</Card>

				{!loading && filteredCategories.length === 0 && <EmptyState icon={<FileText size={24} />} title="No templates found" description="Try adjusting your search." />}

				<div className="space-y-6">
					{filteredCategories.map((category) => (
						<Card key={category.name} className="overflow-hidden">
							<div className="px-5 py-4 border-b border-(--border)/10 bg-(--foreground)">
								<div className="flex items-center justify-between">
									<h2 className="font-semibold">{category.name}</h2>

									<span className="text-xs text-(--text-muted)">
										{category.files.length} {category.files.length === 1 ? 'template' : 'templates'}
									</span>
								</div>
							</div>

							<div className="p-2">
								{category.files.map((file, index) => (
									<button
										key={file.path}
										onClick={() => downloadFile(file.path)}
										className={`w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-(--background) transition-colors ${index !== category.files.length - 1 ? 'border-b border-(--border)/10' : ''}`}
									>
										<div className="h-9 w-9 shrink-0 rounded-lg bg-(--accent)/15 flex items-center justify-center group-hover:bg-(--accent)/20 transition-colors">
											<Download size={16} className="text-(--accent)" />
										</div>

										<div className="min-w-0 flex-1">
											<p className="truncate font-medium">{file.name}</p>
										</div>
									</button>
								))}
							</div>
						</Card>
					))}
				</div>
			</div>
		</NotPermitted>
	);
}
