/** @format */
'use client';

import { Cable, Check, ClipboardCheck, Code, Eye, File, FileText, Folder, ImageIcon, MapPin, Save, Settings, Share, Sun, Ticket } from 'lucide-react';
import { NotPermitted, usePermissions } from '@/providers/PermissionsProvider';
import { useEffect, useState } from 'react';
import { useToast } from '@/providers/ToastProvider';

import Button from '@/components/ui/Button';
import Canbus from '@/components/projects/Canbus';
import Documents from '@/components/projects/Document';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';
import Loading from '@/components/ui/Loading';
import Metadata from '@/components/projects/Metadata';
import Pictures from '@/components/projects/Picture';
import Programmation from '@/components/projects/Programmation';
import Schemas from '@/components/projects/Schema';
import Selector from '@/components/ui/Selector';
import Solar from '@/components/projects/Solar';
import Tabs from '@/components/ui/Tabs';
import Tickets from '@/components/projects/Tickets';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

type Tab = 'info' | 'schemas' | 'documents' | 'programmation' | 'pictures' | 'solar' | 'canbus' | 'tickets';

type Settings = {
	path: string;
	requiredFolders: string[];
};

type MetadataActions = {
	save: () => Promise<void>;
	share: () => Promise<void>;
	hasChanges: boolean;
	saving: boolean;
	saved: boolean;
	label: string;
	setLabel: (label: string) => void;
	labels: {
		name: string;
		color: string;
	}[];
};

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
	const { has } = usePermissions();
	const router = useRouter();
	const toast = useToast();

	const [settings, setSettings] = useState<Settings | null>(null);
	const [projects, setProjects] = useState<any[]>([]);
	const [client, setClient] = useState<string | null>(null);
	const [metadata, setMetadata] = useState<any>(null);
	const [tab, setTab] = useState<Tab>('info');

	const handleShare = async () => {
		try {
			const res = await fetch('/api/projects/metadata', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					client,
					createShareCode: true,
				}),
			});

			if (!res.ok) return;

			const { shareCode } = await res.json();
			const url = new URL(window.location.href);
			url.searchParams.set('code', shareCode);
			url.searchParams.set('view', tab);

			await navigator.clipboard.writeText(url.toString());
			setShared(true);
			setTimeout(() => setShared(false), 1500);
		} catch (error) {
			console.error('Failed to generate share link', error);
		}
	};
	const [loading, setLoading] = useState(true);
	const [shareAccess, setShareAccess] = useState(false);
	const [shared, setShared] = useState(false);
	const [metadataActions, setMetadataActions] = useState<MetadataActions | null>(null);
	const [selectorOpen, setSelectorOpen] = useState(false);

	const tabs = [
		{ key: 'info', label: 'Info', icon: <Folder /> },
		{ key: 'solar', label: 'Solar', icon: <Sun /> },
		{ key: 'schemas', label: 'Schemas', icon: <FileText /> },
		{ key: 'documents', label: 'Documents', icon: <File /> },
		{ key: 'programmation', label: 'Programmation', icon: <Code /> },
		{ key: 'canbus', label: 'Canbus', icon: <Cable /> },
		{ key: 'pictures', label: 'Media', icon: <ImageIcon /> },
		{ key: 'tickets', label: 'Tickets', icon: <Ticket /> },
	] as const;

	const isAllowed = has('projects.write');

	function openMaps() {
		if (!metadata?.address) return;

		const q = [metadata.address.street, metadata.address.number, metadata.address.postalCode, metadata.address.city, metadata.address.country].filter(Boolean).join(' ');

		window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank');
	}

	useEffect(() => {
		(async () => {
			const id = decodeURIComponent((await params).id);
			setClient(id);

			const [s, m, p] = await Promise.all([
				fetch('/api/settings/projects').then((r) => r.json()),
				fetch(`/api/projects/metadata?client=${encodeURIComponent(id)}&reveal=true`)
					.then((r) => r.json())
					.catch(() => null),
				fetch('/api/projects/map').then((r) => r.json()),
			]);

			const code = new URL(window.location.href).searchParams.get('code');
			const initialView = new URL(window.location.href).searchParams.get('view') as Tab;

			if (initialView && tabs.some((t) => t.key === initialView)) {
				setTab(initialView);
			}

			if (code) {
				setShareAccess(m?.shareCode === code);
			}

			setSettings(s);
			setMetadata(m);
			setProjects(p);
			setLoading(false);
		})();
	}, [params]);

	if (loading) return <Loading title={`Loading ${client || 'project'}`} description="Reading project metadata" />;

	if (!metadata || !client) return <EmptyState title="Project not found" description="The requested project could not be loaded." />;

	if (!settings?.path) return <EmptyState title="Projects path not configured" description="Configure a base projects path in settings before opening project data." />;

	return (
		<NotPermitted permission="projects.read" shareAccess={shareAccess}>
			<div className="space-y-6">
				{/* Header */}

				<div>
					<Selector
						className="min-w-0 w-fit -ml-4 [&>button]:bg-transparent [&>button]:border-transparent [&>button]:shadow-none [&>button:hover]:bg-black/5 [&>button]:!justify-start [&>button]:!text-2xl [&>button]:!font-semibold [&>button]:!tracking-tight [&_svg]:opacity-50 [&_svg]:ml-2"
						value={client ?? ''}
						options={projects.map((p) => ({ label: p.name, value: p.name }))}
						onChange={(val) => router.push(`/dashboard/projects/${encodeURIComponent(val)}`)}
					/>

					<p className="text-sm mt-1 text-(--text-muted)">Project dashboard</p>
				</div>

				{/* Navigation */}

				<Tabs
					value={tab}
					onChange={(newTab) => {
						if (metadataActions?.hasChanges) {
							toast('error', 'Please save your changes before switching tabs.');
							return;
						}
						setTab(newTab);
						const url = new URL(window.location.href);
						url.searchParams.set('view', newTab);
						window.history.replaceState({}, '', url.toString());
					}}
					tabs={tabs.map((t) => ({
						id: t.key,
						icon: t.icon,
						label: t.label,
					}))}
				/>

				{/* Floating Actions Dock */}
				<motion.div
					layout
					transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
					className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-2xl bg-(--foreground) shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-(--border)/20 transition-all ${selectorOpen ? 'w-64 sm:w-auto' : ''}`}
				>
					<div className={`flex items-center gap-2 ${selectorOpen ? 'hidden sm:flex' : ''}`}>
						{tab === 'info' && (
							<Button
								icon={metadataActions?.saved ? <Check size={16} /> : <Save size={16} />}
								disabled={!metadataActions?.hasChanges || metadataActions?.saving || !isAllowed}
								onClick={() => metadataActions?.save()}
							>
								<span className="hidden sm:inline">{metadataActions?.saving ? 'Saving...' : metadataActions?.saved ? 'Saved' : 'Save'}</span>
							</Button>
						)}

						<div id="project-dock-actions" className="flex items-center gap-2 empty:hidden" />

						<div className="w-px h-6 bg-(--border)/20 mx-1 hidden sm:block" />

						<Button icon={shared ? <ClipboardCheck size={16} /> : <Share size={16} />} onClick={handleShare} disabled={shared || !isAllowed}>
							<span className="hidden sm:inline">{shared ? 'Copied' : 'Share'}</span>
						</Button>

						<Link href={`/portal/${encodeURIComponent(client)}`}>
							<Button icon={<Eye size={16} />}>
								<span className="hidden sm:inline">View</span>
							</Button>
						</Link>

						<Button icon={<MapPin size={16} />} onClick={openMaps} disabled={!metadata?.address?.city}>
							<span className="hidden sm:inline">Navigate</span>
						</Button>
					</div>

					{tab === 'info' && (
						<Selector
							className={`transition-all duration-300 ease-in-out ${selectorOpen ? 'w-full sm:w-64' : 'w-12 sm:w-48'} !min-w-0 !border-transparent hover:!border-(--border)/10 !bg-transparent hover:!bg-(--background)`}
							hideLabelOnMobile={!selectorOpen}
							direction="up"
							onOpenChange={setSelectorOpen}
							value={metadataActions?.label ?? ''}
							options={[
								{
									label: 'No status',
									value: '',
								},
								...(metadataActions?.labels ?? []).map((label) => ({
									label: label.name,
									value: label.name,
									color: label.color,
								})),
							]}
							onChange={(value) => metadataActions?.setLabel(value)}
						/>
					)}
				</motion.div>

				{/* Content */}

				<motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
					{tab === 'info' && <Metadata client={client} onActionsChange={setMetadataActions} />}
					{tab === 'solar' && <Solar client={client} />}
					{tab === 'schemas' && <Schemas basePath={settings.path} client={client} />}
					{tab === 'documents' && <Documents basePath={settings.path} client={client} />}
					{tab === 'programmation' && <Programmation basePath={settings.path} client={client} />}
					{tab === 'canbus' && <Canbus basePath={settings.path} client={client} />}
					{tab === 'pictures' && <Pictures basePath={settings.path} client={client} />}
					{tab === 'tickets' && <Tickets client={client} />}
				</motion.div>
			</div>
		</NotPermitted>
	);
}
