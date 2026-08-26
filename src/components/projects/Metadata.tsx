/** @format */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Login, { LoginEntry } from './metadata/Login';
import { useEffect, useState } from 'react';

import { APIProvider } from '@vis.gl/react-google-maps';
import Access from './metadata/Access';
import Address from './metadata/Address';
import Button from '../ui/Button';
import Contact from './metadata/Contact';
import EmptyState from '../ui/EmptyState';
import Input from '../ui/Input';
import { User } from 'next-auth';
import { usePermissions } from '@/providers/PermissionsProvider';

type Label = {
	name: string;
	color: string;
};

export type MetadataType = {
	label?: string;
	project?: string;
	contractor?: string;
	architect?: string;

	address?: {
		lat?: number;
		lon?: number;
		street?: string;
		number?: string;
		suite?: string;
		building?: string;
		postalCode?: string;
		city?: string;
		country?: string;
	};

	contacts?: string[];

	logins?: LoginEntry[];

	updatedAt?: string;

	notes: string;

	solar?: {
		maxPanels?: number;
		roofArea?: number;
		yearlyEnergy?: number;
		lastUpdated?: string;
	};
};

type MetadataActions = {
	save: () => Promise<void>;
	share: () => Promise<void>;
	hasChanges: boolean;
	saving: boolean;
	saved: boolean;
	label: string;
	setLabel: (label: string) => void;
	labels: Label[];
};

type Props = {
	client: string;
	onActionsChange?: (actions: MetadataActions) => void;
};

export default function Metadata({ client, onActionsChange }: Props) {
	const { has } = usePermissions();

	const hasWrite = !has('projects.write');

	const [metadata, setMetadata] = useState<MetadataType | null>(null);
	const [initialMetadata, setInitialMetadata] = useState<MetadataType | null>(null);

	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const [openSections, setOpenSections] = useState(['general', 'address', 'contact', 'logins', 'notes']);
	const [users, setUsers] = useState<User[]>([]);
	const [labels, setLabels] = useState<Label[]>([]);
	const [projectNames, setProjectNames] = useState<string[]>([]);
	const [contractorNames, setContractorNames] = useState<string[]>([]);
	const [architectNames, setArchitectNames] = useState<string[]>([]);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [showContractorSuggestions, setShowContractorSuggestions] = useState(false);
	const [showArchitectSuggestions, setShowArchitectSuggestions] = useState(false);

	/* ---------- STYLES ---------- */

	const collapseAnimation = {
		initial: {
			height: 0,
			opacity: 0,
		},
		animate: {
			height: 'auto',
			opacity: 1,
		},
		exit: {
			height: 0,
			opacity: 0,
		},
		transition: {
			duration: 0.15,
		},
	};

	/* ---------- LOGIC ---------- */

	const normalize = (data: MetadataType | null) => {
		if (!data) return data;
		return {
			...data,
			logins: data.logins?.map((l) => ({ ...l, password: undefined })),
		};
	};

	const share = async () => {
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

		await navigator.clipboard.writeText(url.toString());
	};

	const toggleSection = (key: string) => {
		setOpenSections((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
	};

	const save = async () => {
		setSaving(true);
		setSaved(false);

		const payload = {
			...metadata,
			logins: metadata?.logins?.map((l) => ({
				id: l.id,
				label: l.label ?? '',
				link: l.link ?? '',
				username: l.username ?? '',
				password: l.password || undefined,
				client: l.client ?? false,
			})),
		};

		const res = await fetch('/api/projects/metadata', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ client, data: payload }),
		});

		if (!res.ok) {
			setSaving(false);
			return;
		}

		const refreshed = await fetch(`/api/projects/metadata?client=${client}`).then((r) => r.json());

		setMetadata(refreshed);
		setInitialMetadata(refreshed);

		setSaving(false);
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	};

	const hasChanges = JSON.stringify(normalize(metadata)) !== JSON.stringify(normalize(initialMetadata));

	useEffect(() => {
		if (!metadata) {
			return;
		}

		onActionsChange?.({
			save,
			share,
			hasChanges,
			saving,
			saved,
			label: metadata.label ?? '',
			setLabel: (label: string) =>
				setMetadata((prev) => ({
					...prev!,
					label,
				})),
			labels,
		});
	}, [onActionsChange, hasChanges, saving, saved, metadata, labels]);

	useEffect(() => {
		(async () => {
			const res = await fetch(`/api/projects/metadata?client=${encodeURIComponent(client)}&reveal=true`);
			const data = await res.json();

			const migrated = {
				...data,
				logins: Array.isArray(data?.logins)
					? data.logins
					: [
							...(data?.logins?.company ?? []).map((login: any) => ({
								...login,
								id: login.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
								visibleToClient: false,
							})),
							...(data?.logins?.client ?? []).map((login: any) => ({
								...login,
								id: login.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
								visibleToClient: true,
							})),
						],
			};

			setMetadata(migrated);
			setInitialMetadata(migrated);
		})();

		fetch('/api/users')
			.then((r) => r.json())
			.then((d) => setUsers(d.users ?? []));
		fetch('/api/settings/projects')
			.then((r) => r.json())
			.then((d) => setLabels(d.labels ?? []));
		fetch('/api/projects/map')
			.then((r) => r.json())
			.then((d) => {
				const names = d.map((p: any) => p.project).filter((p: any) => p && typeof p === 'string');
				setProjectNames(Array.from(new Set(names)) as string[]);

				const contractors = d.map((p: any) => p.contractor).filter((p: any) => p && typeof p === 'string');
				setContractorNames(Array.from(new Set(contractors)) as string[]);

				const architects = d.map((p: any) => p.architect).filter((p: any) => p && typeof p === 'string');
				setArchitectNames(Array.from(new Set(architects)) as string[]);
			});
	}, [client]);

	/* ---------- UI ---------- */

	if (!metadata) return <EmptyState title="No metadata" description="No metadata could be loaded for this project." />;

	return (
		<section className="space-y-6">
			<div className="rounded-3xl p-6 bg-(--foreground)">
				<Button onClick={() => toggleSection('general')} className="w-full justify-start" variant="secondary">
					<span>General</span>

					{openSections.includes('general') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</Button>

				<AnimatePresence initial={false}>
					{openSections.includes('general') && (
						<motion.div {...collapseAnimation} className="pt-4 overflow-hidden">
							<div className="flex flex-col gap-4">
								<div className="relative">
									<Input
										label="Project Group Name"
										placeholder="e.g. Solar City Phase 1"
										value={metadata.project ?? ''}
										onChange={(e) => {
											setMetadata({ ...metadata, project: e.target.value });
											setShowSuggestions(true);
										}}
										onFocus={() => setShowSuggestions(true)}
										onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
										disabled={hasWrite}
									/>

									<AnimatePresence>
										{showSuggestions && projectNames.filter((n) => n.toLowerCase().includes((metadata.project ?? '').toLowerCase()) && n !== metadata.project).length > 0 && (
											<motion.div
												initial={{ opacity: 0, y: -5 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -5 }}
												className="absolute z-10 w-full mt-2 bg-[var(--background)] border border-[var(--border)]/10 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1"
											>
												{projectNames
													.filter((n) => n.toLowerCase().includes((metadata.project ?? '').toLowerCase()) && n !== metadata.project)
													.map((name) => (
														<div
															key={name}
															className="px-3 py-2 hover:bg-[var(--foreground)] rounded-lg cursor-pointer text-sm font-medium transition-colors"
															onClick={() => {
																setMetadata({ ...metadata, project: name });
																setShowSuggestions(false);
															}}
														>
															{name}
														</div>
													))}
											</motion.div>
										)}
									</AnimatePresence>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="relative">
										<Input
											label="Contractor"
											placeholder="e.g. BuildCorp Inc."
											value={metadata.contractor ?? ''}
											onChange={(e) => {
												setMetadata({ ...metadata, contractor: e.target.value });
												setShowContractorSuggestions(true);
											}}
											onFocus={() => setShowContractorSuggestions(true)}
											onBlur={() => setTimeout(() => setShowContractorSuggestions(false), 200)}
											disabled={hasWrite}
										/>
										<AnimatePresence>
											{showContractorSuggestions &&
												contractorNames.filter((n) => n.toLowerCase().includes((metadata.contractor ?? '').toLowerCase()) && n !== metadata.contractor).length > 0 && (
													<motion.div
														initial={{ opacity: 0, y: -5 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -5 }}
														className="absolute z-10 w-full mt-2 bg-[var(--background)] border border-[var(--border)]/10 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1"
													>
														{contractorNames
															.filter((n) => n.toLowerCase().includes((metadata.contractor ?? '').toLowerCase()) && n !== metadata.contractor)
															.map((name) => (
																<div
																	key={name}
																	className="px-3 py-2 hover:bg-[var(--foreground)] rounded-lg cursor-pointer text-sm font-medium transition-colors"
																	onClick={() => {
																		setMetadata({ ...metadata, contractor: name });
																		setShowContractorSuggestions(false);
																	}}
																>
																	{name}
																</div>
															))}
													</motion.div>
												)}
										</AnimatePresence>
									</div>

									<div className="relative">
										<Input
											label="Architect"
											placeholder="e.g. Design Studio"
											value={metadata.architect ?? ''}
											onChange={(e) => {
												setMetadata({ ...metadata, architect: e.target.value });
												setShowArchitectSuggestions(true);
											}}
											onFocus={() => setShowArchitectSuggestions(true)}
											onBlur={() => setTimeout(() => setShowArchitectSuggestions(false), 200)}
											disabled={hasWrite}
										/>
										<AnimatePresence>
											{showArchitectSuggestions &&
												architectNames.filter((n) => n.toLowerCase().includes((metadata.architect ?? '').toLowerCase()) && n !== metadata.architect).length > 0 && (
													<motion.div
														initial={{ opacity: 0, y: -5 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -5 }}
														className="absolute z-10 w-full mt-2 bg-[var(--background)] border border-[var(--border)]/10 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1"
													>
														{architectNames
															.filter((n) => n.toLowerCase().includes((metadata.architect ?? '').toLowerCase()) && n !== metadata.architect)
															.map((name) => (
																<div
																	key={name}
																	className="px-3 py-2 hover:bg-[var(--foreground)] rounded-lg cursor-pointer text-sm font-medium transition-colors"
																	onClick={() => {
																		setMetadata({ ...metadata, architect: name });
																		setShowArchitectSuggestions(false);
																	}}
																>
																	{name}
																</div>
															))}
													</motion.div>
												)}
										</AnimatePresence>
									</div>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<div className="rounded-3xl p-6 bg-(--foreground)">
				<Button onClick={() => toggleSection('address')} className="w-full justify-start" variant="secondary">
					<span>Address</span>

					{openSections.includes('address') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</Button>

				<AnimatePresence initial={false}>
					{openSections.includes('address') && (
						<motion.div {...collapseAnimation} className="pt-4 overflow-hidden">
							<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!} libraries={['places']}>
								<Address
									value={metadata.address}
									onChange={(address) =>
										setMetadata({
											...metadata,
											address,
										})
									}
								/>
							</APIProvider>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<div className={'rounded-3xl p-6 bg-(--foreground)'}>
				<Button onClick={() => toggleSection('contact')} className="w-full text-left justify-start" variant="secondary">
					<span>Contact</span>

					{openSections.includes('contact') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</Button>

				<AnimatePresence initial={false}>
					{openSections.includes('contact') && (
						<motion.div {...collapseAnimation} className="pt-4 overflow-hidden">
							<Contact
								contacts={metadata.contacts ?? []}
								onChange={(contacts) =>
									setMetadata({
										...metadata,
										contacts,
									})
								}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* LOGINS */}
			<div className={'rounded-3xl p-6 bg-(--foreground)'}>
				<Button onClick={() => toggleSection('logins')} className="w-full text-left justify-start" variant="secondary">
					<span>Logins</span>

					{openSections.includes('logins') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</Button>

				<AnimatePresence initial={false}>
					{openSections.includes('logins') && (
						<motion.div {...collapseAnimation} className="pt-4 overflow-hidden">
							<Login
								value={metadata.logins ?? []}
								onChange={(logins) =>
									setMetadata({
										...metadata,
										logins,
									})
								}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{!hasWrite && (
				<div className={'rounded-3xl p-6 bg-(--foreground)'}>
					<Button onClick={() => toggleSection('access')} className="w-full text-left justify-start" variant="secondary">
						<span>Access</span>

						{openSections.includes('access') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
					</Button>

					<AnimatePresence initial={false}>
						{openSections.includes('access') && (
							<motion.div {...collapseAnimation} className="pt-4 overflow-hidden">
								<Access
									users={users}
									value={(metadata as any).access ?? []}
									onChange={(next: string[]) =>
										setMetadata({
											...metadata,
											access: next,
										} as any)
									}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			)}

			{/* NOTES */}
			<div className={'rounded-3xl p-6 bg-(--foreground)'}>
				<Button onClick={() => toggleSection('notes')} className="w-full text-left justify-start" variant="secondary">
					<span>Notes</span>

					{openSections.includes('notes') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</Button>

				<AnimatePresence initial={false}>
					{openSections.includes('notes') && (
						<motion.div {...collapseAnimation} className="pt-4 overflow-hidden">
							<textarea
								className="w-full min-h-48 rounded-2xl p-4 bg-(--background) outline-none resize-y"
								disabled={hasWrite}
								value={metadata.notes ?? ''}
								onChange={(e) =>
									setMetadata({
										...metadata,
										notes: e.target.value,
									})
								}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</section>
	);
}
