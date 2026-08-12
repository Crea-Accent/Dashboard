/** @format */
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { usePermissions } from './PermissionsProvider';
import { useSession } from 'next-auth/react';

type Project = {
	name: string;
	label?: string;
	color?: string;
	distance: number;
	lat: number;
	lng: number;
};

type ProjectPromptContextType = {};

const ProjectPromptContext = createContext<ProjectPromptContextType | null>(null);

const NEARBY_DISTANCE_METERS = 100;
const DISMISS_DURATION = 1000 * 60 * 60; // 1 hour

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
	const R = 6371000;

	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;

	const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;

	return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ProjectPromptProvider({ children }: { children: React.ReactNode }) {
	const { data: session } = useSession();
	const { has } = usePermissions();
	const router = useRouter();
	const pathname = usePathname();

	const [projects, setProjects] = useState<Project[]>([]);
	const [location, setLocation] = useState<{
		lat: number;
		lng: number;
	} | null>(null);

	const [open, setOpen] = useState(false);

	useEffect(() => {
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setLocation({
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
				});
			},
			console.error,
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 30000,
			}
		);

		(async () => {
			try {
				const response = await fetch('/api/projects/map');
				const data = await response.json();

				if (Array.isArray(data)) {
					setProjects(data);
				} else {
					console.error('Expected array of projects, got:', data);
					setProjects([]);
				}
			} catch (error) {
				console.error(error);
			}
		})();
	}, []);

	const nearbyProjects = useMemo(() => {
		if (!location) return [];

		return projects
			.filter((project) => {
				if (!project.lat || !project.lng) return false;

				const distance = distanceMeters(location.lat, location.lng, project.lat, project.lng);

				project.distance = distance;

				return distance <= NEARBY_DISTANCE_METERS;
			})
			.sort((a, b) => a.distance - b.distance);
	}, [projects, location]);

	useEffect(() => {
		if (nearbyProjects.length === 0) {
			setOpen(false);
			return;
		}

		const alreadyViewing = nearbyProjects.some((project) => pathname.startsWith(`/dashboard/projects/${encodeURIComponent(project.name)}`));

		if (alreadyViewing) {
			return;
		}

		const dismissKey = nearbyProjects
			.map((x) => x.name)
			.sort()
			.join('|');

		const dismissedAt = localStorage.getItem(`project-prompt-${dismissKey}`);

		if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION) {
			return;
		}

		setOpen(true);
	}, [nearbyProjects, pathname]);

	function dismiss() {
		const dismissKey = nearbyProjects
			.map((x) => x.name)
			.sort()
			.join('|');

		localStorage.setItem(`project-prompt-${dismissKey}`, Date.now().toString());

		setOpen(false);
	}

	function openProject(project: Project) {
		setOpen(false);

		router.push(`/dashboard/projects/${encodeURIComponent(project.name)}`);
	}

	return (
		<ProjectPromptContext.Provider value={{}}>
			{children}

			{session && session?.user.preferences?.projectPrompts && has('projects.read') && (
				<Modal open={open} title={nearbyProjects.length === 1 ? 'Nearby Project Found' : 'Nearby Projects Found'} onClose={dismiss} size='md'>
					<div className='space-y-4'>
						<div className='text-sm text-(--text-muted)'>{nearbyProjects.length === 1 ? 'You appear to be at a project location.' : 'You appear to be near multiple project locations.'}</div>

						<div className='space-y-3 max-h-72 overflow-y-auto pr-1 pt-2'>
							{nearbyProjects.map((project) => (
								<button
									key={project.name}
									onClick={() => openProject(project)}
									className='w-full rounded-2xl border border-(--border)/10 bg-(--foreground) p-4 text-left transition-all hover:border-(--accent) hover:-translate-y-0.5'>
									<div className='flex items-center gap-3'>
										<div
											className='h-3 w-3 shrink-0 rounded-full'
											style={{
												background: project.color ?? 'var(--accent)',
											}}
										/>

										<div className='min-w-0'>
											<div className='truncate font-medium'>{project.name}</div>

											{project.label && (
												<div className='flex gap-1 items-center text-(--text-muted) text-xs'>
													<div className=''>{project.label}</div>•<div className=''>{Math.round(project.distance)}m</div>
												</div>
											)}
										</div>
									</div>
								</button>
							))}
						</div>

						<div className='flex justify-between items-center pt-2'>
							<span className='text-xs text-(--text-muted)'>
								{nearbyProjects.length} nearby project{nearbyProjects.length === 1 ? '' : 's'}
							</span>

							<Button variant='secondary' onClick={dismiss}>
								Dismiss
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</ProjectPromptContext.Provider>
	);
}

export function useProjectPrompt() {
	const ctx = useContext(ProjectPromptContext);

	if (!ctx) {
		throw new Error('ProjectPrompt must be used inside ProjectPromptProvider');
	}

	return ctx;
}
