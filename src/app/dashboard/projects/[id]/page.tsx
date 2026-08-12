/** @format */
'use client';

import { Cable, Check, ClipboardCheck, Code, Eye, File, FileText, Folder, ImageIcon, Save, Settings, Share, Sun, Ticket } from 'lucide-react';
import { NotPermitted, usePermissions } from '@/providers/PermissionsProvider';
import { useEffect, useState } from 'react';

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

	const [settings, setSettings] = useState<Settings | null>(null);
	const [projects, setProjects] = useState<any[]>([]);
	const [client, setClient] = useState<string | null>(null);
	const [metadata, setMetadata] = useState<any>(null);
	const [tab, setTab] = useState<Tab>('info');
	const [loading, setLoading] = useState(true);
	const [shareAccess, setShareAccess] = useState(false);
	const [shared, setShared] = useState(false);
	const [metadataActions, setMetadataActions] = useState<MetadataActions | null>(null);

	const tabs = [
		{ key: 'info', label: 'Info', icon: <Folder /> },
		{ key: 'solar', label: 'Solar', icon: <Sun /> },
		{ key: 'schemas', label: 'Schemas', icon: <FileText /> },
		{ key: 'documents', label: 'Documents', icon: <File /> },
		{ key: 'programmation', label: 'Programmation', icon: <Code /> },
		{ key: 'canbus', label: 'Canbus', icon: <Cable /> },
		{ key: 'pictures', label: 'Pictures', icon: <ImageIcon /> },
		{ key: 'tickets', label: 'Tickets', icon: <Ticket /> },
	] as const;

	const isAllowed = has('projects.write');

	useEffect(() => {
		(async () => {
			const id = decodeURIComponent((await params).id);
			setClient(id);

			const [s, m, p] = await Promise.all([
				fetch('/api/settings/projects').then((r) => r.json()),
				fetch(`/api/projects/metadata?client=${encodeURIComponent(id)}&reveal=true`)
					.then((r) => r.json())
					.catch(() => null),
				fetch('/api/projects/map').then((r) => r.json())
			]);

			const code = new URL(window.location.href).searchParams.get('code');

			if (code) {
				setShareAccess(m?.shareCode === code);
			}

			setSettings(s);
			setMetadata(m);
			setProjects(p);
			setLoading(false);
		})();
	}, [params]);

	if (loading) return <Loading title={`Loading ${client || 'project'}`} description='Reading project metadata' />;

	if (!metadata || !client) return <EmptyState title='Project not found' description='The requested project could not be loaded.' />;

	if (!settings?.path) return <EmptyState title='Projects path not configured' description='Configure a base projects path in settings before opening project data.' />;

	return (
		<NotPermitted permission='projects.read' shareAccess={shareAccess}>
			<div className='space-y-6'>
				{/* Header */}

				<div>
					<Selector
						className='min-w-0 w-fit -ml-4 [&>button]:bg-transparent [&>button]:border-transparent [&>button]:shadow-none [&>button:hover]:bg-black/5 [&>button]:!justify-start [&>button]:!text-2xl [&>button]:!font-semibold [&>button]:!tracking-tight [&_svg]:opacity-50 [&_svg]:ml-2'
						value={client ?? ''}
						options={projects.map((p) => ({ label: p.name, value: p.name }))}
						onChange={(val) => router.push(`/dashboard/projects/${encodeURIComponent(val)}`)}
					/>

					<p className='text-sm mt-1 text-(--text-muted)'>Project dashboard</p>
				</div>

				{/* Navigation + Actions */}

				<div className='flex flex-col lg:flex-row lg:items-center gap-3 p-2 rounded-3xl bg-(--foreground)'>
					<Tabs
						value={tab}
						onChange={setTab}
						tabs={tabs.map((t) => ({
							id: t.key,
							icon: t.icon,
							label: t.label,
						}))}
					/>

					{/* Actions */}

					<div className='flex flex-wrap gap-2 lg:ml-auto'>
						<Button
							icon={metadataActions?.saved ? <Check size={16} /> : <Save size={16} />}
							disabled={!metadataActions?.hasChanges || metadataActions?.saving || !isAllowed}
							onClick={() => metadataActions?.save()}>
							<span className='hidden sm:inline'>{metadataActions?.saving ? 'Saving...' : metadataActions?.saved ? 'Saved' : 'Save'}</span>
						</Button>

						<Button
							icon={shared ? <ClipboardCheck size={16} /> : <Share size={16} />}
							onClick={() => {
								metadataActions?.share();
								setShared(true);
								setTimeout(() => {
									setShared(false);
								}, 1500);
							}}
							disabled={shared || !isAllowed}>
							<span className='hidden sm:inline'>{shared ? 'Copied' : 'Share'}</span>
						</Button>

						<Link href={`/portal/${encodeURIComponent(client)}`}>
							<Button icon={<Eye />}>View</Button>
						</Link>

						<Selector
							className='min-w-52'
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
					</div>
				</div>

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
