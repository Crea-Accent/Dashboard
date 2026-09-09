/** @format */
'use client';

import {
	Upload,
	Cable,
	Pointer,
	Plus,
	Radio,
	RefreshCw,
	Wrench,
	Loader2,
	Printer,
	Terminal,
	Check,
	ClipboardCheck,
	Code,
	Eye,
	File,
	FileText,
	Folder,
	ImageIcon,
	MapPin,
	Save,
	Settings,
	Share,
	Sun,
	Ticket,
	Network,
} from 'lucide-react';
import { NotPermitted, usePermissions } from '@/providers/PermissionsProvider';
import { useEffect, useState } from 'react';
import { useToast } from '@/providers/ToastProvider';

import Button from '@/components/ui/Button';
import Canbus from '@/components/projects/Canbus';
import IpList from '@/components/projects/IpList';
import Controls from '@/components/projects/Controls';
import Feed from '@/components/projects/Feed';
import Documents from '@/components/projects/Document';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';
import Loading from '@/components/ui/Loading';
import Metadata from '@/components/projects/Metadata';
import Pictures from '@/components/projects/Picture';
import Programmation from '@/components/projects/Programmation';
import Schemas from '@/components/projects/Schema';
import ViewToggle from '@/components/ui/ViewToggle';
import Selector from '@/components/ui/Selector';
import Solar from '@/components/projects/Solar';
import Tabs from '@/components/ui/Tabs';
import Tickets from '@/components/projects/Tickets';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

type Tab = 'info' | 'schemas' | 'documents' | 'programmation' | 'pictures' | 'solar' | 'canbus' | 'ips' | 'controls' | 'tickets' | 'feed';

type Settings = {
	path: string;
	requiredFolders: string[];
};

type ControlsActions = {
	print: () => void;
	printing: boolean;
};

type FileTabActions = {
	view: 'list' | 'grid';
	setView: (v: 'list' | 'grid') => void;
	canWrite: boolean;
	uploading: boolean;
	clickUpload: () => void;
	hasNewGroup: boolean;
	openNewGroup?: () => void;
};

type TicketsActions = {
	tickets: any[];
	generatingPdf: string | null;
	isAllowed: boolean;
	generateProjectPDF: () => void;
	openNewTicket: () => void;
};

type FeedActions = {
	showBuilder: boolean;
	setShowBuilder: (val: boolean) => void;
	isLive: boolean;
	setIsLive: (val: boolean) => void;
	refresh: () => void;
	loading: boolean;
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
	const [feedActions, setFeedActions] = useState<FeedActions | null>(null);
	const [ticketsActions, setTicketsActions] = useState<TicketsActions | null>(null);
	const [controlsActions, setControlsActions] = useState<ControlsActions | null>(null);
	const [schemaActions, setSchemaActions] = useState<FileTabActions | null>(null);
	const [documentActions, setDocumentActions] = useState<FileTabActions | null>(null);
	const [programmationActions, setProgrammationActions] = useState<FileTabActions | null>(null);
	const [picturesActions, setPicturesActions] = useState<FileTabActions | null>(null);
	const [ipsActions, setIpsActions] = useState<any>(null);
	const [selectorOpen, setSelectorOpen] = useState(false);

	const allTabs = [
		{ key: 'info', label: 'Info', icon: <Folder /> },
		{ key: 'tickets', label: 'Tickets', icon: <Ticket /> },
		{ key: 'schemas', label: 'Schemas', icon: <FileText /> },
		{ key: 'documents', label: 'Documents', icon: <File /> },
		{ key: 'pictures', label: 'Media', icon: <ImageIcon /> },
		{ key: 'solar', label: 'Solar', icon: <Sun /> },
		{ key: 'programmation', label: 'Programmation', icon: <Code /> },
		{ key: 'canbus', label: 'Canbus', icon: <Cable /> },
		{ key: 'ips', label: 'Network', icon: <Network /> },
		{ key: 'controls', label: 'Controls', icon: <Pointer /> },
		{ key: 'feed', label: 'Feed', icon: <Terminal /> },
	] as const;

	const tabs = allTabs.filter((t) => t.key !== 'tickets' || has('tickets.read'));

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
			<div className="flex flex-col h-full min-h-0">
				{/* Header & Navigation */}
				<div className="shrink-0 z-40 bg-(--background) pb-4 flex flex-col xl:flex-row justify-between xl:items-center gap-4 border-b border-(--border)/10 mb-6 print:hidden">
					<Selector
						className="min-w-0 w-fit -ml-4 [&>button]:bg-transparent [&>button]:border-transparent [&>button]:shadow-none [&>button:hover]:bg-black/5 [&>button]:!justify-start [&>button]:!text-2xl [&>button]:!font-semibold [&>button]:!tracking-tight [&_svg]:opacity-50 [&_svg]:ml-2"
						value={client ?? ''}
						options={projects.map((p) => ({ label: p.name, value: p.name }))}
						onChange={(val) => router.push(`/dashboard/projects/${encodeURIComponent(val)}`)}
					/>

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
				</div>

				{/* Floating Actions Dock */}
				<motion.div
					layout
					transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
					className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-2xl bg-(--foreground) shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-(--border)/20 transition-all max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none ${selectorOpen ? 'w-64 sm:w-auto' : ''}`}
				>
					<div className={`flex items-center gap-2 shrink-0 ${selectorOpen ? 'hidden sm:flex' : ''}`}>
						{tab === 'info' && (
							<Button
								icon={metadataActions?.saved ? <Check size={16} /> : <Save size={16} />}
								disabled={!metadataActions?.hasChanges || metadataActions?.saving || !isAllowed}
								onClick={() => metadataActions?.save()}
							>
								<span className="hidden sm:inline">{metadataActions?.saving ? 'Saving...' : metadataActions?.saved ? 'Saved' : 'Save'}</span>
							</Button>
						)}
						{tab === 'tickets' && ticketsActions && (
							<>
								{ticketsActions.tickets.length > 0 && (
									<Button
										variant="secondary"
										onClick={() => ticketsActions.generateProjectPDF()}
										disabled={ticketsActions.generatingPdf !== null}
										icon={ticketsActions.generatingPdf === 'project' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
									>
										<span className="hidden sm:inline">{ticketsActions.generatingPdf === 'project' ? 'Generating...' : 'Project Summary'}</span>
									</Button>
								)}
								{ticketsActions.isAllowed && (
									<Button onClick={() => ticketsActions.openNewTicket()} icon={<Plus size={16} />}>
										<span className="hidden sm:inline">New Ticket</span>
									</Button>
								)}
							</>
						)}
						{(tab === 'schemas' || tab === 'documents' || tab === 'programmation' || tab === 'pictures') &&
							(() => {
								const actions = tab === 'schemas' ? schemaActions : tab === 'documents' ? documentActions : tab === 'pictures' ? picturesActions : programmationActions;
								if (!actions) return null;
								return (
									<>
										<ViewToggle value={actions.view} onChange={actions.setView} />
										{actions.canWrite && actions.hasNewGroup && actions.openNewGroup && (
											<Button onClick={() => actions.openNewGroup!()} icon={<Plus size={16} />}>
												<span className="hidden sm:inline">New Group</span>
											</Button>
										)}
										{actions.canWrite && (
											<Button
												icon={actions.uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
												onClick={() => actions.clickUpload()}
												disabled={actions.uploading}
											>
												<span className="hidden sm:inline">{actions.uploading ? 'Uploading...' : 'Upload'}</span>
											</Button>
										)}
									</>
								);
							})()}

						{tab === 'ips' && (
							<>
								{ipsActions?.openNewIp && (
									<Button onClick={() => ipsActions.openNewIp()} icon={<Plus size={16} />}>
										<span className="hidden sm:inline">Add IP</span>
									</Button>
								)}
								<Button
									variant="secondary"
									onClick={() => ipsActions?.refresh()}
									disabled={ipsActions?.saving}
									icon={ipsActions?.saving ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
								>
									Refresh
								</Button>
								<Button
									variant={ipsActions?.hasChanges ? 'primary' : 'secondary'}
									onClick={() => ipsActions?.save()}
									disabled={!ipsActions?.hasChanges || ipsActions?.saving}
									icon={ipsActions?.saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
								>
									{ipsActions?.saving ? 'Saving...' : 'Save'}
								</Button>
							</>
						)}

						{tab === 'controls' && controlsActions && (
							<Button
								variant="ghost"
								icon={controlsActions.printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
								disabled={controlsActions.printing}
								onClick={() => controlsActions.print()}
							>
								<span className="hidden sm:inline">{controlsActions.printing ? 'Preparing...' : 'Print Layout'}</span>
							</Button>
						)}
						{tab === 'feed' && feedActions && (
							<>
								<Button
									variant={feedActions.showBuilder ? 'secondary' : 'ghost'}
									icon={<Wrench size={16} className={feedActions.showBuilder ? 'text-[var(--accent)]' : ''} />}
									onClick={() => feedActions.setShowBuilder(!feedActions.showBuilder)}
								>
									<span className="hidden sm:inline">{feedActions.showBuilder ? 'Close' : 'Builder'}</span>
								</Button>
								<Button
									variant={feedActions.isLive ? 'primary' : 'secondary'}
									icon={<Radio size={16} className={feedActions.isLive ? 'animate-pulse text-white' : 'text-[var(--accent)]'} />}
									onClick={() => feedActions.setIsLive(!feedActions.isLive)}
								>
									<span className="hidden sm:inline">{feedActions.isLive ? 'Live' : 'Go Live'}</span>
								</Button>
								<Button
									variant="ghost"
									icon={<RefreshCw size={16} className={feedActions.loading ? 'animate-spin' : ''} />}
									disabled={feedActions.loading || feedActions.isLive}
									onClick={() => feedActions.refresh()}
								>
									<span className="hidden sm:inline">Refresh</span>
								</Button>
							</>
						)}

						<div id="project-dock-actions" className="flex items-center gap-2 empty:hidden overflow-x-auto max-w-[calc(100vw-3rem)] sm:max-w-none scrollbar-none" />

						<div className="w-px h-6 bg-(--border)/20 mx-1 hidden sm:block" />

						<Button className="shrink-0" icon={shared ? <ClipboardCheck size={16} /> : <Share size={16} />} onClick={handleShare} disabled={shared || !isAllowed}>
							<span className="hidden sm:inline">{shared ? 'Copied' : 'Share'}</span>
						</Button>

						<Link href={`/portal/${encodeURIComponent(client)}`} className="shrink-0">
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
				<div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4 md:-mx-6 md:px-6 pb-32">
					<motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="h-full flex flex-col min-h-0">
						{tab === 'info' && <Metadata client={client} onActionsChange={setMetadataActions} />}
						{tab === 'solar' && <Solar client={client} />}
						{tab === 'schemas' && <Schemas basePath={settings.path} client={client} onActionsChange={setSchemaActions} />}
						{tab === 'documents' && <Documents basePath={settings.path} client={client} onActionsChange={setDocumentActions} />}
						{tab === 'programmation' && <Programmation basePath={settings.path} client={client} onActionsChange={setProgrammationActions} />}
						{tab === 'canbus' && <Canbus basePath={settings.path} client={client} />}
						{tab === 'ips' && <IpList client={client} onActionsChange={setIpsActions} />}
						{tab === 'controls' && <Controls basePath={settings.path} client={client} onActionsChange={setControlsActions} />}
						{tab === 'pictures' && <Pictures basePath={settings.path} client={client} onActionsChange={setPicturesActions} />}
						{tab === 'tickets' && <Tickets client={client} onActionsChange={setTicketsActions} />}
						{tab === 'feed' && <Feed projectId={metadata?.id} onActionsChange={setFeedActions} />}
					</motion.div>
				</div>
			</div>
		</NotPermitted>
	);
}
