/** @format */
'use client';

import { APIProvider, AdvancedMarker, ColorScheme, Map, useMap } from '@vis.gl/react-google-maps';
import { Clock, FolderKanban, MapPin, Search, TrendingUp } from 'lucide-react';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EnergyCard from '@/components/EnergyCard';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import Modal from '@/components/ui/Modal';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/providers/ThemeProvider';

type FileEntry = {
	path: string;
	name: string;
	type: 'directory' | 'file';
	size?: number | null;
	modified?: string | null;
};

type Settings = {
	path: string;
	requiredFolders: string[];
};

type ProjectMapEntry = {
	name: string;
	label: string | null;
	color: string;
	lat: number;
	lng: number;
	contacts: number;
	updatedAt: string | null;

	address: any;
};

function MarkerCluster({ children }: { children: (setMarkerRef: (marker: google.maps.marker.AdvancedMarkerElement | null, key: string) => void) => React.ReactNode }) {
	const map = useMap();

	const clusterer = useRef<MarkerClusterer | null>(null);

	const [markers, setMarkers] = useState<Record<string, google.maps.marker.AdvancedMarkerElement>>({});

	useEffect(() => {
		if (!map || clusterer.current) return;

		clusterer.current = new MarkerClusterer({ map });
	}, [map]);

	useEffect(() => {
		if (!clusterer.current) return;

		clusterer.current.clearMarkers();
		clusterer.current.addMarkers(Object.values(markers));
	}, [markers]);

	const setMarkerRef = (marker: google.maps.marker.AdvancedMarkerElement | null, key: string) => {
		setMarkers((prev) => {
			const next = { ...prev };

			if (marker) {
				next[key] = marker;
			} else {
				delete next[key];
			}

			return next;
		});
	};

	return <>{children(setMarkerRef)}</>;
}

export default function Home() {
	const searchRef = useRef<HTMLInputElement | null>(null);

	const { resolvedTheme } = useTheme();
	const { data: session } = useSession();

	const [settings, setSettings] = useState<Settings | null>(null);
	const [projects, setProjects] = useState<FileEntry[]>([]);
	const [mapProjects, setMapProjects] = useState<ProjectMapEntry[]>([]);
	const [query, setQuery] = useState('');
	const [loading, setLoading] = useState(true);
	const [recentOpened, setRecentOpened] = useState<string[]>([]);
	const [selectedProject, setSelectedProject] = useState<ProjectMapEntry | null>(null);

	const userName = session?.user?.name?.split(' ')[0] ?? 'there';

	function pushRecent(name: string) {
		const next = [name, ...recentOpened.filter((p) => p !== name)].slice(0, 6);
		setRecentOpened(next);
		localStorage.setItem('recentProjects', JSON.stringify(next));
	}

	function getGreeting() {
		const hour = new Date().getHours();

		if (hour < 6) return 'Good night';
		if (hour < 12) return 'Good morning';
		if (hour < 18) return 'Good afternoon';
		if (hour < 22) return 'Good evening';

		return 'Good night';
	}

	const filteredProjects = useMemo(() => {
		const q = query.toLowerCase().trim();

		if (!q) {
			return [];
		}

		const searched = mapProjects.filter((p) => {
			const searchable = [p.name, p.address?.street, p.address?.number, p.address?.postalCode, p.address?.city, p.address?.country].filter(Boolean).join(' ').toLowerCase();

			return searchable.includes(q);
		});

		return searched.map((p) => ({
			...projects.find((pr) => pr.name == p.name),
			...searched,
		}));
	}, [mapProjects, query]);

	const sortedByRecent = useMemo(() => {
		return [...projects].sort((a, b) => {
			const aDate = a.modified ? new Date(a.modified).getTime() : 0;
			const bDate = b.modified ? new Date(b.modified).getTime() : 0;
			return bDate - aDate;
		});
	}, [projects]);

	const updatedLast7Days = useMemo(() => {
		const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		return projects.filter((p) => p.modified && new Date(p.modified).getTime() > weekAgo).length;
	}, [projects]);

	const recentProjectsResolved = useMemo(() => {
		return recentOpened.map((name) => projects.find((p) => p.name === name)).filter(Boolean) as FileEntry[];
	}, [recentOpened, projects]);

	useEffect(() => {
		(async () => {
			try {
				const s = await fetch('/api/settings/projects').then((r) => r.json());
				setSettings(s);

				if (!s.path) {
					setLoading(false);
					return;
				}

				const res = await fetch(`/api/files?view=${encodeURIComponent(s.path)}`);
				const data = await res.json();

				if (Array.isArray(data)) {
					setProjects(data.filter((f: any) => f.type === 'directory'));
				} else {
					setProjects([]);
				}

				const mapData = await fetch('/api/projects/map').then((r) => r.json());

				if (Array.isArray(mapData)) {
					setMapProjects(mapData.filter((p: any) => p.hasLocation));
				} else {
					setMapProjects([]);
				}
			} finally {
				setLoading(false);
			}
		})();

		const stored = localStorage.getItem('recentProjects');
		if (stored) setRecentOpened(JSON.parse(stored));

		const handler = (e: KeyboardEvent) => {
			if (e.key === '/') {
				e.preventDefault();
				searchRef.current?.focus();
			}
		};

		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, []);

	return (
		<div className="w-full space-y-10">
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
				<Card
					className="relative overflow-hidden p-8 md:p-10"
					style={{
						background: `
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--accent) 10%, var(--foreground)),
				var(--foreground)
			)
		`,
					}}
				>
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							background: `
			radial-gradient(
				600px circle at top right,
				color-mix(in srgb, var(--accent) 15%, transparent),
				transparent 70%
			)
		`,
						}}
					/>
					<div className="relative z-10 grid md:grid-cols-[1fr_320px] gap-8 items-start min-h-40">
						<div className="space-y-4">
							<h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
								{getGreeting()}, {userName}
							</h1>

							<p
								className="mt-2"
								style={{
									color: 'var(--text-muted)',
								}}
							>
								Here's what's happening across your projects, installations and systems.
							</p>

							<div className="relative z-10 max-w-xl">
								<Input ref={searchRef} icon={<Search size={18} />} placeholder="Search projects... (press /)" value={query} onChange={(e) => setQuery(e.target.value)} />
							</div>
						</div>

						<div className="space-y-3">
							{query &&
								filteredProjects.slice(0, 3).map((p) => {
									if (!p) return;

									return (
										<Link
											key={p.path}
											href={`/dashboard/projects/${encodeURIComponent(p.name as string)}`}
											onClick={() => pushRecent(p.name as string)}
											className="block transition"
										>
											<Button className="flex justify-start w-full" variant={'secondary'}>
												<p className="text-(--text)">{p.name}</p>

												<div className="text-(--text-muted)">{p.modified && <p>{new Date(p.modified).toLocaleDateString()}</p>}</div>
											</Button>
										</Link>
									);
								})}
						</div>
					</div>
				</Card>
			</motion.div>

			<Card className="overflow-hidden">
				<div style={{ height: 500 }}>
					<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
						<Map
							mapId={'map'}
							colorScheme={(resolvedTheme.toUpperCase() as ColorScheme) ?? 'DARK'}
							defaultCenter={{
								lat: 50.85,
								lng: 4.35,
							}}
							defaultZoom={8}
							gestureHandling="greedy"
							style={{
								width: '100%',
								height: '100%',
							}}
						>
							<MarkerCluster>
								{(setMarkerRef) =>
									mapProjects.map((project) => {
										const isHighlighted = query.trim().length > 0 && filteredProjects.some((p) => p.name === project.name);

										return (
											<AdvancedMarker
												key={project.name}
												ref={(marker) => setMarkerRef(marker, project.name)}
												position={{
													lat: project.lat,
													lng: project.lng,
												}}
											>
												<div
													onClick={() => setSelectedProject(project)}
													className="relative cursor-pointer"
													style={{
														opacity: query.trim().length === 0 ? 1 : isHighlighted ? 1 : 0.2,
													}}
												>
													{/* Pulse */}
													<div
														className={isHighlighted ? 'absolute animate-ping' : 'absolute'}
														style={{
															width: isHighlighted ? 30 : 24,
															height: isHighlighted ? 30 : 24,
															left: -4,
															top: -4,
															background: project.color,
															borderRadius: '999px',
															opacity: query.trim().length === 0 ? 0.25 : isHighlighted ? 0.35 : 0,
														}}
													/>

													{/* Pin */}
													<div
														className="flex items-center justify-center text-white text-[9px] font-bold select-none"
														style={{
															width: isHighlighted ? 30 : 24,
															height: isHighlighted ? 30 : 24,
															background: project.color,
															borderRadius: '50% 50% 50% 0',
															transform: 'rotate(-45deg)',
															border: '2px solid white',
															boxShadow: isHighlighted ? `0 0 20px ${project.color}, 0 4px 12px rgba(0,0,0,0.35)` : '0 4px 12px rgba(0,0,0,0.35)',
															transition: 'all 0.2s ease',
														}}
													>
														<span
															style={{
																transform: 'rotate(45deg)',
															}}
														>
															{project.name
																.replace(/[^a-zA-Z0-9]/g, '')
																.substring(0, 2)
																.toUpperCase()}
														</span>
													</div>
												</div>
											</AdvancedMarker>
										);
									})
								}
							</MarkerCluster>
						</Map>
					</APIProvider>
				</div>
			</Card>

			<section className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<StatCard icon={<FolderKanban size={18} />} label="Total Projects" value={loading ? '—' : projects.length} />
				<StatCard icon={<TrendingUp size={18} />} label="Updated last 7 days" value={loading ? '—' : updatedLast7Days} />
				<EnergyCard />
			</section>

			<Modal
				open={!!selectedProject}
				title={selectedProject?.name ?? 'Project'}
				onClose={() => setSelectedProject(null)}
				size="md"
				footer={
					selectedProject && (
						<Link href={`/dashboard/projects/${encodeURIComponent(selectedProject.name)}`}>
							<Button>Open Project</Button>
						</Link>
					)
				}
			>
				{selectedProject && (
					<div className="space-y-5">
						<div
							className="rounded-2xl p-4"
							style={{
								background: 'var(--foreground)',
							}}
						>
							<div className="flex items-center gap-3">
								<div
									style={{
										width: 14,
										height: 14,
										borderRadius: 999,
										background: selectedProject.color,
										boxShadow: `0 0 12px ${selectedProject.color}`,
									}}
								/>

								<div className="min-w-0">
									<div className="font-semibold truncate">{selectedProject.label ?? 'No Label'}</div>

									<div
										className="text-sm"
										style={{
											color: 'var(--text-muted)',
										}}
									>
										Project Status
									</div>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div
								className="rounded-xl p-3"
								style={{
									background: 'var(--foreground)',
								}}
							>
								<div
									className="text-xs uppercase tracking-wider"
									style={{
										color: 'var(--text-muted)',
									}}
								>
									City
								</div>

								<div className="font-medium">{selectedProject.address?.city ?? '-'}</div>
							</div>

							<div
								className="rounded-xl p-3"
								style={{
									background: 'var(--foreground)',
								}}
							>
								<div
									className="text-xs uppercase tracking-wider"
									style={{
										color: 'var(--text-muted)',
									}}
								>
									Postal Code
								</div>

								<div className="font-medium">{selectedProject.address?.postalCode ?? '-'}</div>
							</div>
						</div>

						{selectedProject.address && (
							<div
								className="rounded-xl p-4"
								style={{
									background: 'var(--foreground)',
								}}
							>
								<div
									className="text-xs uppercase tracking-wider mb-2"
									style={{
										color: 'var(--text-muted)',
									}}
								>
									Address
								</div>

								<div>{[selectedProject.address.street, selectedProject.address.number].filter(Boolean).join(' ')}</div>

								<div
									style={{
										color: 'var(--text-muted)',
									}}
								>
									{[selectedProject.address.postalCode, selectedProject.address.city].filter(Boolean).join(' ')}
								</div>
							</div>
						)}

						{selectedProject.updatedAt && (
							<div
								className="rounded-xl p-4"
								style={{
									background: 'var(--foreground)',
								}}
							>
								<div
									className="text-xs uppercase tracking-wider mb-1"
									style={{
										color: 'var(--text-muted)',
									}}
								>
									Last Updated
								</div>

								<div>{new Date(selectedProject.updatedAt).toLocaleDateString()}</div>
							</div>
						)}
					</div>
				)}
			</Modal>

			{recentProjectsResolved.length > 0 && (
				<Card className="p-6 space-y-4">
					<h2 className="text-base font-semibold flex items-center gap-2">
						<Clock size={16} className="text-(--accent)" />
						Recently Opened
					</h2>

					<div className="space-y-1">
						{recentProjectsResolved.map((p) => (
							<Link
								key={p.path}
								href={`/dashboard/projects/${encodeURIComponent(p.name)}`}
								onClick={() => pushRecent(p.name)}
								className="flex justify-between items-center px-4 py-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
							>
								<span className="text-sm font-medium">{p.name}</span>
							</Link>
						))}
					</div>
				</Card>
			)}

			<Card className="p-6 space-y-4">
				<h2 className="text-base font-semibold flex items-center gap-2">
					<Clock size={16} className="text-(--accent)" />
					Recently Updated
				</h2>

				<div className="space-y-1">
					{sortedByRecent.slice(0, 5).map((p) => (
						<Link
							key={p.path}
							href={`/dashboard/projects/${encodeURIComponent(p.name)}`}
							onClick={() => pushRecent(p.name)}
							className="flex justify-between items-center px-4 py-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
						>
							<span className="text-sm font-medium">{p.name}</span>

							<span className="text-xs text-zinc-500">{p.modified ? new Date(p.modified).toLocaleDateString() : ''}</span>
						</Link>
					))}
				</div>
			</Card>
		</div>
	);
}

function StatCard({ icon, label, value }: { icon: ReactElement; label: string; value: string | number }) {
	return (
		<Card className="p-6">
			<div className="flex items-center gap-3 mb-4">
				<div
					className="
						w-10 h-10
						rounded-xl
						bg-(--active-accent)
						dark:bg-(--accent)/30
						text-(--accent)
						flex items-center justify-center
					"
				>
					{icon}
				</div>

				<span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</span>
			</div>

			<p className="text-2xl font-semibold">{value}</p>
		</Card>
	);
}
