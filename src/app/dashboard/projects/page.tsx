/** @format */
'use client';

import { ArrowDownAZ, ArrowUpAZ, Filter, Folder, MapPin, Pencil, Plus, Search } from 'lucide-react';
import { NotPermitted, usePermissions } from '@/providers/PermissionsProvider';
import { useEffect, useMemo, useState } from 'react';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import Loading from '@/components/ui/Loading';
import Modal from '@/components/ui/Modal';
import MultiSelector from '@/components/ui/MultiSelector';
import PageHeader from '@/components/ui/PageHeader';
import Selector from '@/components/ui/Selector';
import Skeleton from '@/components/ui/Skeleton';
import ViewToggle from '@/components/ui/ViewToggle';
import { getContrastYIQ } from '@/lib/color';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

type LabelSetting = {
	name: string;
	color: string;
};

type Project = {
	path: string;
	name: string;
	type: string;
	label?: string;
	project?: string;
	updatedAt?: string;
	address?: {
		street?: string;
		number?: string;
		suite?: string;
		postalCode?: string;
		city?: string;
		country?: string;
	};
};

type Settings = {
	path: string;
	requiredFolders: string[];
	labels?: LabelSetting[];
};

type SortKey = 'name' | 'updated' | 'address' | 'label' | 'project';

export default function Page() {
	const { data: session } = useSession();
	const { has, loading } = usePermissions();
	const router = useRouter();

	const [projects, setProjects] = useState<Project[]>([]);
	const [settings, setSettings] = useState<Settings | null>(null);

	const [creating, setCreating] = useState(false);
	const [newProjectName, setNewProjectName] = useState('');

	const [renaming, setRenaming] = useState(false);
	const [renameProjectName, setRenameProjectName] = useState('');
	const [renameTarget, setRenameTarget] = useState('');

	const [query, setQuery] = useState('');
	const [labelFilters, setLabelFilters] = useState<string[]>([]);
	const [projectFilters, setProjectFilters] = useState<string[]>([]);
	const [view, setView] = useState<'grid' | 'list'>(session?.user?.preferences?.defaultView ?? 'list');
	const [showFilters, setShowFilters] = useState(false);

	const [sortKey, setSortKey] = useState<SortKey>('name');
	const [sortAsc, setSortAsc] = useState(true);

	const uniqueProjects = useMemo(() => {
		const names = new Set(projects.map((p) => p.project).filter(Boolean) as string[]);
		return Array.from(names).sort();
	}, [projects]);

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			setSortAsc(!sortAsc);
		} else {
			setSortKey(key);
			setSortAsc(true);
		}
	}

	async function createProject() {
		if (!settings?.path || !newProjectName.trim()) return;

		const name = newProjectName.trim();
		const newPath = `${settings.path}/${name}`;

		await fetch(`/api/files?view=${encodeURIComponent(newPath)}`);

		setCreating(false);
		setNewProjectName('');

		router.push(`/dashboard/projects/${encodeURIComponent(name)}`);
	}

	function renameProject(oldName: string) {
		setRenameTarget(oldName);
		setRenameProjectName(oldName);
		setRenaming(true);
	}

	async function submitRenameProject() {
		if (!settings?.path) return;

		const next = renameProjectName.trim();

		if (!next || next === renameTarget) {
			setRenaming(false);
			return;
		}

		await fetch('/api/files', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				oldPath: `${settings.path}/${renameTarget}`,
				newName: next,
			}),
		});

		setProjects((current) =>
			current.map((project) =>
				project.name === renameTarget
					? {
							...project,
							name: next,
							path: project.path.replace(renameTarget, next),
						}
					: project
			)
		);

		setRenaming(false);
		setRenameTarget('');
		setRenameProjectName('');
	}

	function openMaps(p: Project) {
		if (!p.address) return;

		const q = [p.address.street, p.address.number, p.address.postalCode, p.address.city, p.address.country].filter(Boolean).join(' ');

		window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank');
	}

	function labelColor(name?: string) {
		if (!name || !settings?.labels) return 'var(--accent)';

		const l = settings.labels.find((l) => l.name === name);
		return l?.color ?? 'var(--accent)';
	}

	const filteredProjects = useMemo(() => {
		let list = [...projects];

		const q = query.toLowerCase().trim();

		list = list.filter((p) => {
			if (
				q &&
				!p.name.toLowerCase().includes(q) &&
				!p.project?.toLowerCase().includes(q) &&
				!p.label?.toLowerCase().includes(q) &&
				!p.address?.street?.toLowerCase().includes(q) &&
				!p.address?.country?.toLowerCase().includes(q) &&
				!p.address?.city?.toLowerCase().includes(q)
			)
				return false;
			if (labelFilters.length > 0 && (!p.label || !labelFilters.includes(p.label))) {
				return false;
			}
			if (projectFilters.length > 0 && (!p.project || !projectFilters.includes(p.project))) {
				return false;
			}
			return true;
		});

		list.sort((a, b) => {
			switch (sortKey) {
				case 'name':
					return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);

				case 'address': {
					const aAddr = [a.address?.suite, a.address?.street, a.address?.number, a.address?.city].filter(Boolean).join(', ');
					const bAddr = [b.address?.suite, b.address?.street, b.address?.number, b.address?.city].filter(Boolean).join(', ');
					return sortAsc ? aAddr.localeCompare(bAddr) : bAddr.localeCompare(aAddr);
				}

				case 'project':
					return sortAsc ? (a.project ?? '').localeCompare(b.project ?? '') : (b.project ?? '').localeCompare(a.project ?? '');

				case 'label':
					return sortAsc ? (a.label ?? '').localeCompare(b.label ?? '') : (b.label ?? '').localeCompare(a.label ?? '');

				case 'updated': {
					const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;

					const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;

					return sortAsc ? aDate - bDate : bDate - aDate;
				}

				default:
					return 0;
			}
		});

		return list;
	}, [projects, query, labelFilters, projectFilters, sortKey, sortAsc]);

	useEffect(() => {
		async function load() {
			const [settings, projects] = await Promise.all([fetch('/api/settings/projects').then((r) => r.json()), fetch('/api/projects/map').then((r) => r.json())]);

			setSettings(settings);
			setProjects(projects);

			if (session) setView(session?.user?.preferences?.defaultView ?? 'list');
		}

		load();
	}, [session]);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			if (e.key === '/') {
				e.preventDefault();
				document.getElementById('project-search')?.focus();
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && has('projects.write')) {
				e.preventDefault();
				setCreating(true);
			} else if (e.key.toLowerCase() === 'v') {
				setView((v) => (v === 'grid' ? 'list' : 'grid'));
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [has]);

	if (loading) {
		return (
			<div className="space-y-6">
				<PageHeader icon={<Folder size={20} />} title="Projects" description="Browse and manage projects" />
				<div className="flex gap-2">
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 flex-1" />
				</div>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-40 w-full rounded-2xl" />
					))}
				</div>
			</div>
		);
	}

	return (
		<NotPermitted permission="projects.read">
			<motion.div className="space-y-6">
				{/* Header */}

				<PageHeader icon={<Folder size={20} />} title="Projects" description="Browse and manage projects" />

				{/* Search + Filter */}

				<div className="flex flex-col xl:flex-row gap-3 xl:items-center">
					{/* Level 1: New and Search */}
					<div className="flex gap-2 w-full xl:flex-1">
						{has('projects.write') && (
							<Button icon={<Plus size={16} />} onClick={() => setCreating(true)} className="shrink-0" title="Cmd/Ctrl + N">
								<span className="hidden sm:inline">New Project</span>
							</Button>
						)}

						<div className="flex-1 min-w-0">
							<Input id="project-search" icon={<Search size={16} />} placeholder="Search projects... (Press /)" value={query} onChange={(e) => setQuery(e.target.value)} />
						</div>
					</div>

					{/* Level 2: Actions */}
					<div className="flex flex-wrap xl:flex-nowrap gap-2 w-full xl:w-auto">
						<div className="flex gap-2 shrink-0">
							<Button variant="secondary" icon={sortAsc ? <ArrowUpAZ size={16} /> : <ArrowDownAZ size={16} />} onClick={() => setSortAsc(!sortAsc)} />

							<ViewToggle value={view} onChange={setView} />

							<Button variant="secondary" icon={<Filter size={16} />} className="xl:hidden" onClick={() => setShowFilters(!showFilters)} />
						</div>

						<div className={`flex gap-2 flex-col sm:flex-row w-full xl:w-auto transition-all ${showFilters ? 'flex' : 'hidden xl:flex'}`}>
							<Selector
								className="!min-w-0 flex-1"
								value={sortKey}
								onChange={(value) => setSortKey(value as SortKey)}
								options={[
									{ label: 'Name', value: 'name' },
									{ label: 'Updated', value: 'updated' },
									{ label: 'Address', value: 'address' },
									{ label: 'Project', value: 'project' },
									{ label: 'Label', value: 'label' },
								]}
							/>

							<MultiSelector
								className="!min-w-0 flex-1"
								placeholder="All Projects"
								value={projectFilters}
								onChange={setProjectFilters}
								options={uniqueProjects.map((p) => ({
									label: p,
									value: p,
								}))}
							/>

							<MultiSelector
								className="!min-w-0 flex-1"
								placeholder="All Labels"
								value={labelFilters}
								onChange={setLabelFilters}
								options={
									settings?.labels?.map((label) => ({
										label: label.name,
										value: label.name,
										color: label.color,
									})) || []
								}
							/>
						</div>
					</div>
				</div>

				{/* Table */}

				<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
					{filteredProjects.length === 0 ? (
						<div className="py-12">
							<EmptyState title="No projects found" description="Try adjusting your search filters or create a new project." />
						</div>
					) : view === 'list' ? (
						<Card className="overflow-hidden">
							<div className="grid grid-cols-[1fr_24px_80px] md:grid-cols-[1fr_120px_24px_80px] xl:grid-cols-[1fr_120px_140px_120px_100px] px-5 h-11 items-center text-xs font-semibold text-(--text-muted) border-b border-(--border)/10">
								<button onClick={() => toggleSort('name')} className="text-left">
									Name
								</button>
								<button onClick={() => toggleSort('project')} className="hidden md:block text-left">
									Project
								</button>
								<span className="text-center xl:text-left">Label</span>
								<button onClick={() => toggleSort('updated')} className="hidden xl:block text-left">
									Updated
								</button>
								<span className="text-right">Actions</span>
							</div>

							{filteredProjects.map((p, index) => (
								<motion.div
									layout
									layoutId={`project-${p.path}`}
									key={p.path}
									className={`grid grid-cols-[1fr_24px_80px] md:grid-cols-[1fr_120px_24px_80px] xl:grid-cols-[1fr_120px_140px_120px_100px] items-center h-16 px-5 text-sm hover:bg-(--background) transition-colors ${index !== filteredProjects.length - 1 ? 'border-b border-(--border)/10' : ''}`}
								>
									<Link href={`/dashboard/projects/${encodeURIComponent(p.name)}`} className="flex items-center gap-3 min-w-0">
										<div
											className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
											style={{
												background: p.label ? labelColor(p.label) : 'var(--accent)',
												color: p.label ? getContrastYIQ(labelColor(p.label)) : 'white',
											}}
										>
											{p.name.slice(0, 2).toUpperCase()}
										</div>
										<div className="min-w-0">
											<div className="truncate font-medium">{p.name}</div>

											<div className="truncate text-xs text-(--text-muted) h-4">
												{[p.address?.suite, p.address?.street, p.address?.number, p.address?.city].filter(Boolean).join(', ')}
											</div>
										</div>
									</Link>

									{/* Key */}
									<div className="hidden md:block text-sm font-medium text-[var(--text-muted)] min-w-0 pr-4">
										<div className="truncate">{p.project || '—'}</div>
									</div>

									{/* Label */}
									<div className="flex justify-center xl:justify-start min-w-0 pr-2">
										{p.label && (
											<>
												<span
													className="w-2.5 h-2.5 rounded-full xl:hidden shrink-0"
													style={{
														backgroundColor: labelColor(p.label),
													}}
												/>

												<div className="hidden xl:block truncate">{p.label}</div>
											</>
										)}
									</div>

									{/* Updated */}
									<div className="hidden xl:block text-xs text-(--text-muted) truncate">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}</div>
									{/* Actions */}
									<div className="flex justify-end gap-1">
										{p.address?.city && <Button size="sm" variant="ghost" icon={<MapPin size={16} />} onClick={() => openMaps(p)} />}

										{has('projects.write') && <Button size="sm" variant="ghost" icon={<Pencil size={16} />} onClick={() => renameProject(p.name)} />}
									</div>
								</motion.div>
							))}
						</Card>
					) : (
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{filteredProjects.map((p, i) => (
								<motion.div layout layoutId={`project-${p.path}`} key={p.path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
									<Link href={`/dashboard/projects/${encodeURIComponent(p.name)}`} key={i}>
										<Card className="p-5 min-h-40 transition-all hover:-translate-y-0.5 hover:border-(--accent)">
											<div className="flex items-start justify-between mb-4">
												<div>
													<div className="font-semibold">{p.name || ''}</div>

													<div className="text-sm text-(--text-muted)">
														{[p.address?.suite, p.address?.street, p.address?.number, p.address?.city].filter(Boolean).join(', ')}
													</div>
												</div>

												{p.label && <Badge color={labelColor(p.label)}>{p.label}</Badge>}
											</div>

											<div className="text-xs text-(--text-muted) mb-4">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'No updates'}</div>

											<div className="flex gap-2 justify-end">
												{has('projects.write') && <Button size="sm" variant="ghost" icon={<Pencil size={16} />} onClick={() => renameProject(p.name)} />}

												<div className="flex gap-2">{p.address?.city && <Button size="sm" variant="ghost" icon={<MapPin size={14} />} onClick={() => openMaps(p)} />}</div>
											</div>
										</Card>
									</Link>
								</motion.div>
							))}
						</div>
					)}
				</motion.div>
			</motion.div>

			<Modal
				open={creating}
				title="Create Project"
				onClose={() => {
					setCreating(false);
					setNewProjectName('');
				}}
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => {
								setCreating(false);
								setNewProjectName('');
							}}
						>
							Cancel
						</Button>

						<Button onClick={createProject}>Create</Button>
					</>
				}
			>
				<Input
					autoFocus
					value={newProjectName}
					onChange={(e) => setNewProjectName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							createProject();
						}
					}}
					placeholder="Project name"
				/>
			</Modal>

			<Modal
				open={renaming}
				title="Rename Project"
				onClose={() => {
					setRenaming(false);
					setRenameTarget('');
					setRenameProjectName('');
				}}
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => {
								setRenaming(false);
								setRenameTarget('');
								setRenameProjectName('');
							}}
						>
							Cancel
						</Button>

						<Button onClick={submitRenameProject}>Rename</Button>
					</>
				}
			>
				<Input
					autoFocus
					value={renameProjectName}
					onChange={(e) => setRenameProjectName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							submitRenameProject();
						}
					}}
					placeholder="Project name"
				/>
			</Modal>
		</NotPermitted>
	);
}
