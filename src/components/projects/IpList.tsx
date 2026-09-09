'use client';
import { useState, useEffect } from 'react';
import { Plus, Save, Network, RefreshCw, Trash2, Edit3, X, Check, Activity, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { MetadataType, IpEntry } from '@/components/projects/Metadata';
import { motion, AnimatePresence } from 'framer-motion';
import Toggle from '@/components/ui/Toggle';
import Modal from '@/components/ui/Modal';
import { usePermissions } from '@/providers/PermissionsProvider';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

type IpListActions = {
	save: () => Promise<void>;
	refresh: () => Promise<void>;
	saving: boolean;
	hasChanges: boolean;
	openNewIp: () => void;
};

type Props = {
	client: string;
	onActionsChange?: (actions: IpListActions) => void;
};

const collapseAnimation = {
	initial: { height: 0, opacity: 0 },
	animate: { height: 'auto', opacity: 1 },
	exit: { height: 0, opacity: 0 },
	transition: { duration: 0.2 },
};

export default function IpList({ client, onActionsChange }: Props) {
	const { has } = usePermissions();
	const hasWrite = has('projects.write');

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);

	const [metadata, setMetadata] = useState<MetadataType | null>(null);
	const [manualIps, setManualIps] = useState<IpEntry[]>([]);
	const [extractedIps, setExtractedIps] = useState<IpEntry[]>([]);

	const [openSubnets, setOpenSubnets] = useState<string[]>([]);
	const [createOpen, setCreateOpen] = useState(false);
	const [newIp, setNewIp] = useState<IpEntry>({
		id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
		ip: '',
		mac: '',
		name: '',
		status: 'static',
	});
	const [editingId, setEditingId] = useState<string | null>(null);
	const [pingStatus, setPingStatus] = useState<Record<string, 'loading' | 'alive' | 'dead'>>({});

	const pingIp = async (id: string, ip: string) => {
		setPingStatus((prev) => ({ ...prev, [id]: 'loading' }));
		try {
			const res = await fetch(`/api/ping?ip=${ip}`);
			const data = await res.json();
			setPingStatus((prev) => ({ ...prev, [id]: data.alive ? 'alive' : 'dead' }));
		} catch {
			setPingStatus((prev) => ({ ...prev, [id]: 'dead' }));
		}
	};

	const pingAll = async (entries: IpEntry[]) => {
		const updates = {} as Record<string, 'loading'>;
		entries.forEach((e) => (updates[e.id] = 'loading'));
		setPingStatus((prev) => ({ ...prev, ...updates }));

		await Promise.all(
			entries.map(async (entry) => {
				try {
					const res = await fetch(`/api/ping?ip=${entry.ip}`);
					const data = await res.json();
					setPingStatus((prev) => ({ ...prev, [entry.id]: data.alive ? 'alive' : 'dead' }));
				} catch {
					setPingStatus((prev) => ({ ...prev, [entry.id]: 'dead' }));
				}
			})
		);
	};

	const toggleSubnet = (subnet: string) => {
		if (openSubnets.includes(subnet)) {
			setOpenSubnets(openSubnets.filter((s) => s !== subnet));
		} else {
			setOpenSubnets([...openSubnets, subnet]);
		}
	};

	const loadData = async () => {
		setLoading(true);
		try {
			// 1. Fetch metadata & IPs
			const metaRes = await fetch(`/api/projects/metadata?client=${encodeURIComponent(client)}`);
			const meta: MetadataType = await metaRes.json();
			setMetadata(meta);

			const ipsRes = await fetch(`/api/projects/ips?client=${encodeURIComponent(client)}`);
			if (ipsRes.ok) {
				const ips = await ipsRes.json();
				setManualIps(Array.isArray(ips) ? ips : []);
			}

			// 2. Fetch programmation files to find projectnodeservices.json
			const basePathRes = await fetch('/api/settings/projects');
			const basePathData = await basePathRes.json();
			const programmationPath = `${basePathData.path}/${client}/Programmation`;

			const filesRes = await fetch(`/api/files?view=${encodeURIComponent(programmationPath)}&recursive=1`);
			if (filesRes.ok) {
				const files = await filesRes.json();
				const nodeServicesFiles = files.filter((f: any) => f.name.toLowerCase() === 'projectnodeservices.json');

				if (nodeServicesFiles.length > 0) {
					// Pick the latest one based on the folder date
					let newExtractedIps: IpEntry[] = [];

					// 1. Process projectnodeservices.json
					const latestFile = nodeServicesFiles.sort((a: any, b: any) => new Date(b.modified).getTime() - new Date(a.modified).getTime())[0];
					if (latestFile) {
						const jsonRes = await fetch(`/api/files/download?path=${encodeURIComponent(latestFile.path)}`);
						if (jsonRes.ok) {
							const data = await jsonRes.json();
							if (data.serverNodes && Array.isArray(data.serverNodes)) {
								newExtractedIps.push(
									...data.serverNodes.map((n: any) => ({
										id: `extracted-node-${n.logicalAddress || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15))}`,
										ip: n.localAddress || '',
										mac: n.MAC || '',
										name: `Node ${n.logicalAddress}`,
										status: 'static' as const,
									}))
								);
							}
						}
					}

					// 2. Process cameras.json
					const cameraFiles = files.filter((f: any) => f.name.toLowerCase() === 'cameras.json');
					if (cameraFiles.length > 0) {
						const latestCamFile = cameraFiles.sort((a: any, b: any) => new Date(b.modified).getTime() - new Date(a.modified).getTime())[0];
						const camRes = await fetch(`/api/files/download?path=${encodeURIComponent(latestCamFile.path)}`);
						if (camRes.ok) {
							const cams = await camRes.json();
							if (Array.isArray(cams)) {
								const ipRegex = /(?:http|https|rtsp):\/\/([0-9\.]+)/;
								cams.forEach((cam: any) => {
									if (cam.cam_url) {
										const match = cam.cam_url.match(ipRegex);
										if (match && match[1]) {
											newExtractedIps.push({
												id: `extracted-cam-${cam.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15))}`,
												ip: match[1],
												mac: '',
												name: `Camera: ${cam.name || 'Unknown'}`,
												status: 'static' as const,
											});
										}
									}
								});
							}
						}
					}

					setExtractedIps(newExtractedIps.filter((p) => p.ip));
				}
			}
		} catch (error) {
			console.error('Failed to load IP list data', error);
		} finally {
			setLoading(false);
			setHasChanges(false);
		}
	};

	useEffect(() => {
		loadData();
	}, [client]);

	const save = async () => {
		setSaving(true);
		try {
			await fetch('/api/projects/ips', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client,
					ips: manualIps,
				}),
			});
			setHasChanges(false);
		} catch (error) {
			console.error('Failed to save IP list', error);
		} finally {
			setSaving(false);
		}
	};

	useEffect(() => {
		if (onActionsChange) {
			onActionsChange({
				save,
				refresh: loadData,
				openNewIp: () => setCreateOpen(true),
				saving,
				hasChanges,
			});
		}
	}, [saving, hasChanges, manualIps, metadata]);

	if (loading) {
		return (
			<div className="p-8 flex justify-center">
				<Network className="animate-pulse text-(--text-muted)" size={32} />
			</div>
		);
	}

	// Combine IPs. Manual IPs overwrite extracted IPs if they have the exact same IP.
	const combinedMap = new Map<string, IpEntry & { isManual: boolean; isOverride?: boolean }>();
	extractedIps.forEach((ip) => {
		const key = ip.mac || ip.ip;
		combinedMap.set(key, { ...ip, id: `ext-${key}`, isManual: false });
	});
	manualIps.forEach((ip) => {
		const key = ip.mac || ip.ip;
		if (combinedMap.has(key)) {
			const existing = combinedMap.get(key)!;
			combinedMap.set(key, {
				...existing, // keep the fresh IP, MAC, and status from the programmation file
				name: ip.name || existing.name, // ONLY override the custom name
				id: ip.id,
				isManual: true,
				isOverride: true,
			});
		} else {
			combinedMap.set(key, { ...ip, isManual: true });
		}
	});

	const allIps = Array.from(combinedMap.values());

	// Group by subnet (e.g. 192.168.0.x)
	const subnets: Record<string, IpEntry[]> = {};
	allIps.forEach((ip) => {
		const parts = ip.ip.split('.');
		let subnet = 'Unknown';
		if (parts.length === 4) {
			subnet = `${parts[0]}.${parts[1]}.${parts[2]}.x`;
		}
		if (!subnets[subnet]) subnets[subnet] = [];
		subnets[subnet].push(ip);
	});

	Object.keys(subnets).forEach((subnet) => {
		subnets[subnet].sort((a, b) => {
			const aLast = parseInt(a.ip.split('.')[3] || '0', 10);
			const bLast = parseInt(b.ip.split('.')[3] || '0', 10);
			return aLast - bLast;
		});
	});

	const addIp = () => {
		if (!newIp.ip) return;
		setManualIps([...manualIps, { ...newIp, id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) }]);
		setHasChanges(true);
		setCreateOpen(false);
		setNewIp({ id: '', ip: '', mac: '', name: '', status: 'static' });

		const parts = newIp.ip.split('.');
		if (parts.length === 4) {
			const sub = `${parts[0]}.${parts[1]}.${parts[2]}.x`;
			if (!openSubnets.includes(sub)) setOpenSubnets([...openSubnets, sub]);
		}
	};

	const removeIp = (id: string) => {
		setManualIps(manualIps.filter((i) => i.id !== id));
		setHasChanges(true);
	};

	const updateManualIp = (id: string, updates: Partial<IpEntry>) => {
		setManualIps(manualIps.map((i) => (i.id === id ? { ...i, ...updates } : i)));
		setHasChanges(true);
	};

	const startEdit = (entry: IpEntry & { isManual?: boolean }) => {
		if (!entry.isManual) {
			const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
			const newManual: IpEntry = {
				id: newId,
				ip: entry.ip,
				mac: entry.mac || '',
				name: entry.name,
				status: entry.status,
			};
			setManualIps([...manualIps, newManual]);
			setEditingId(newId);
			setHasChanges(true);
		} else {
			setEditingId(entry.id);
		}
	};

	return (
		<div className="flex flex-col gap-8 pb-32">
			{Object.keys(subnets).length === 0 ? (
				<EmptyState title="No IP Addresses Found" description="Upload a DuoTecno project or manually add IPs to track them here." />
			) : (
				<div className="flex flex-col gap-4">
					{Object.keys(subnets)
						.sort()
						.map((subnet) => (
							<div key={subnet} className="bg-[var(--foreground)] rounded-3xl overflow-hidden shadow-sm">
								<button className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--background)] transition-colors" onClick={() => toggleSubnet(subnet)}>
									<div className="flex items-center gap-3">
										<Network className="text-(--accent)" size={20} />
										<span className="font-semibold text-(--text) text-lg">{subnet}</span>
										<span className="text-xs font-medium text-(--text-muted) bg-(--foreground) px-2 py-1 rounded-full">{subnets[subnet].length} IPs</span>
									</div>
								</button>

								<AnimatePresence initial={false}>
									{openSubnets.includes(subnet) && (
										<motion.div {...collapseAnimation} className="">
											<div className="p-4 grid gap-2">
												<div className="flex justify-between items-center mb-2 px-2">
													<span className="text-sm font-medium text-[var(--text-muted)]">Devices</span>
													<Button variant="ghost" size="sm" onClick={() => pingAll(subnets[subnet])} icon={<Activity size={14} />} className="!h-7 text-xs">
														Ping All
													</Button>
												</div>
												{subnets[subnet].map((entry) => {
													const isManual = (entry as any).isManual;
													const isOverride = (entry as any).isOverride;
													const manualEntry = isManual ? manualIps.find((m) => m.id === entry.id) : null;
													const isEditing = editingId === entry.id;

													return (
														<div key={entry.id} className="flex flex-col md:flex-row md:items-center gap-4 bg-[var(--background)] p-4 rounded-2xl">
															{isEditing && manualEntry ? (
																isOverride ? (
																	<div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] gap-3 items-center">
																		<div className="w-full font-mono text-sm text-[var(--text)]">
																			<span className="opacity-50">{entry.ip.split('.').slice(0, 3).join('.')}.</span>
																			<span className="font-bold text-[var(--accent)]">{entry.ip.split('.')[3]}</span>
																		</div>
																		<Input
																			value={manualEntry.name}
																			onChange={(e) => updateManualIp(manualEntry.id, { name: e.target.value })}
																			placeholder="Device Name"
																		/>
																		<div className="text-xs text-[var(--text-muted)] font-mono truncate">{entry.mac}</div>
																		<Button variant="primary" size="sm" className="h-11 px-3" onClick={() => setEditingId(null)} icon={<Check size={16} />} />
																	</div>
																) : (
																	<div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
																		<Input
																			value={manualEntry.ip}
																			onChange={(e) => updateManualIp(manualEntry.id, { ip: e.target.value })}
																			placeholder="192.168.0.x"
																		/>
																		<Input
																			value={manualEntry.name}
																			onChange={(e) => updateManualIp(manualEntry.id, { name: e.target.value })}
																			placeholder="Device Name"
																		/>
																		<Input
																			value={manualEntry.mac ?? ''}
																			onChange={(e) => updateManualIp(manualEntry.id, { mac: e.target.value })}
																			placeholder="MAC (optional)"
																		/>
																		<div className="flex items-center gap-2">
																			<select
																				className="bg-[var(--background)] border border-[var(--border)] text-[var(--text)] text-sm rounded-xl focus:ring-[var(--accent)] focus:border-[var(--accent)] block w-full p-2.5 h-11"
																				value={manualEntry.status}
																				onChange={(e) => updateManualIp(manualEntry.id, { status: e.target.value as any })}
																			>
																				<option value="static">Static</option>
																				<option value="free">Free</option>
																				<option value="dhcp">DHCP</option>
																			</select>
																			<Button variant="primary" size="sm" className="h-11 px-3" onClick={() => setEditingId(null)} icon={<Check size={16} />} />
																		</div>
																	</div>
																)
															) : (
																<>
																	<div className="w-full md:w-48 font-mono text-sm text-(--text)">
																		<span className="opacity-50">{entry.ip.split('.').slice(0, 3).join('.')}.</span>
																		<span className="font-bold text-(--accent)">{entry.ip.split('.')[3]}</span>
																	</div>
																	<div className="flex-1 min-w-0">
																		<div className="font-medium text-(--text) truncate">{entry.name || 'Unknown Device'}</div>
																		{entry.mac && <div className="text-xs text-(--text-muted) font-mono mt-1">{entry.mac}</div>}
																	</div>
																	<div className="flex items-center gap-4">
																		<div
																			className={`text-xs font-medium px-2.5 py-1 rounded-full
																		${entry.status === 'static' ? 'bg-blue-500/10 text-blue-500' : entry.status === 'free' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}
																		>
																			{entry.status.toUpperCase()}
																		</div>
																		{(!isManual || isOverride) && (
																			<div className="text-xs text-[var(--text-muted)] bg-[var(--background)] px-2 py-1 rounded-full">Auto</div>
																		)}

																		<div className="flex items-center gap-1">
																			<Button variant="ghost" size="sm" onClick={() => pingIp(entry.id, entry.ip)} className="!px-2" title="Ping IP">
																				{pingStatus[entry.id] === 'loading' ? (
																					<Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
																				) : pingStatus[entry.id] === 'alive' ? (
																					<Activity size={16} className="text-green-500" />
																				) : pingStatus[entry.id] === 'dead' ? (
																					<Activity size={16} className="text-red-500" />
																				) : (
																					<Activity size={16} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" />
																				)}
																			</Button>
																			{hasWrite && (
																				<>
																					<Button
																						variant="ghost"
																						size="sm"
																						onClick={() => startEdit(entry as any)}
																						icon={<Edit3 size={16} />}
																						className="!px-2 text-[var(--text-muted)] hover:text-[var(--text)]"
																					/>
																					{isManual && (
																						<Button
																							variant="danger"
																							size="sm"
																							onClick={() => removeIp(entry.id)}
																							icon={<Trash2 size={16} />}
																							className="!px-2"
																							title={isOverride ? 'Revert to auto IP' : 'Delete'}
																						/>
																					)}
																				</>
																			)}
																		</div>
																	</div>
																</>
															)}
														</div>
													);
												})}
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						))}
				</div>
			)}

			<Modal open={createOpen} title="Add IP Address" size="md" onClose={() => setCreateOpen(false)}>
				<div className="flex flex-col gap-4">
					<Input label="IP Address" value={newIp.ip} onChange={(e) => setNewIp({ ...newIp, ip: e.target.value })} placeholder="192.168.0.x" />
					<Input label="Device Name" value={newIp.name} onChange={(e) => setNewIp({ ...newIp, name: e.target.value })} placeholder="e.g. Printer, Free Slot" />
					<Input label="MAC Address" value={newIp.mac ?? ''} onChange={(e) => setNewIp({ ...newIp, mac: e.target.value })} placeholder="Optional" />

					<div className="space-y-2">
						<label className="text-sm font-medium text-(--text)">Status</label>
						<select
							className="bg-(--foreground) border border-(--border) text-(--text) text-sm rounded-2xl focus:ring-(--accent) focus:border-(--accent) block w-full p-3 h-12"
							value={newIp.status}
							onChange={(e) => setNewIp({ ...newIp, status: e.target.value as any })}
						>
							<option value="static">Static (Reserved)</option>
							<option value="free">Free (Available)</option>
							<option value="dhcp">DHCP (Dynamic)</option>
						</select>
					</div>

					<div className="flex justify-end gap-2 mt-4">
						<Button variant="secondary" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button variant="primary" onClick={addIp} disabled={!newIp.ip}>
							Add IP
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
