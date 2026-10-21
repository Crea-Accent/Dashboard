'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Save, Network, RefreshCw, Trash2, Edit3, X, Check, Activity, Loader2, Search, Copy, ExternalLink, AlertTriangle, ChevronsUpDown, Zap, Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { MetadataType, IpEntry, GatewayTriggerItem } from '@/components/projects/Metadata';
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
	const [searchQuery, setSearchQuery] = useState('');
	const [copiedId, setCopiedId] = useState<string | null>(null);
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
	const [pingLatency, setPingLatency] = useState<Record<string, number>>({});
	const [reachableSubnets, setReachableSubnets] = useState<Record<string, boolean>>({});

	// Gateway HTTP Trigger Modal state
	const [activeGateway, setActiveGateway] = useState<IpEntry | null>(null);
	const [wildcardId, setWildcardId] = useState<string>('0');
	const [triggerResponses, setTriggerResponses] = useState<
		Record<
			string,
			{
				status: 'idle' | 'loading' | 'success' | 'error';
				message?: string;
				ms?: number;
			}
		>
	>({});

	const openTriggerModal = (entry: IpEntry) => {
		setActiveGateway(entry);
		setWildcardId('0');
		setTriggerResponses({});
	};

	const sendTrigger = async (idNum: number, responseKey = String(idNum)) => {
		if (!activeGateway) return;
		const clampedId = Math.max(0, Math.min(99, Number.isNaN(idNum) ? 0 : idNum));
		const port = activeGateway.httpPort || 8080;
		const url = `http://${activeGateway.ip.trim()}:${port}/trigger/${clampedId}`;

		setTriggerResponses((prev) => ({ ...prev, [responseKey]: { status: 'loading' } }));
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3000);
		const start = performance.now();

		try {
			const res = await fetch(url, {
				mode: 'no-cors',
				cache: 'no-store',
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			const ms = Math.max(1, Math.round(performance.now() - start));
			let bodyText = '';
			try {
				if (res.type !== 'opaque') {
					bodyText = await res.text();
				}
			} catch {
				// Ignore body read error on opaque response
			}
			setTriggerResponses((prev) => ({
				...prev,
				[responseKey]: {
					status: 'success',
					ms,
					message: bodyText.trim() || `200 OK — Trigger #${clampedId} sent (${ms}ms)`,
				},
			}));
		} catch (err: any) {
			clearTimeout(timeoutId);
			const ms = Math.max(1, Math.round(performance.now() - start));
			setTriggerResponses((prev) => ({
				...prev,
				[responseKey]: {
					status: 'error',
					ms,
					message: err?.name === 'AbortError' ? 'Timed out (3000ms)' : `Unreachable (${ms}ms)`,
				},
			}));
		}
	};

	const copyToClipboard = (id: string, text: string) => {
		navigator.clipboard?.writeText(text);
		setCopiedId(id);
		setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
	};

	const probeLocalIp = async (ip: string, timeoutMs = 2200): Promise<{ alive: boolean; ms?: number }> => {
		const cleanIp = ip.trim();
		if (!cleanIp) return { alive: false };
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		const start = performance.now();
		try {
			await fetch(`http://${cleanIp}`, {
				mode: 'no-cors',
				cache: 'no-store',
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			return { alive: true, ms: Math.max(1, Math.round(performance.now() - start)) };
		} catch {
			clearTimeout(timeoutId);
			return { alive: false };
		}
	};

	const pingIp = async (id: string, ip: string) => {
		setPingStatus((prev) => ({ ...prev, [id]: 'loading' }));
		const result = await probeLocalIp(ip);
		setPingStatus((prev) => ({ ...prev, [id]: result.alive ? 'alive' : 'dead' }));
		if (result.ms !== undefined) {
			setPingLatency((prev) => ({ ...prev, [id]: result.ms! }));
		}
	};

	const pingAll = async (entries: IpEntry[]) => {
		const updates = {} as Record<string, 'loading'>;
		entries.forEach((e) => (updates[e.id] = 'loading'));
		setPingStatus((prev) => ({ ...prev, ...updates }));

		await Promise.all(
			entries.map(async (entry) => {
				const result = await probeLocalIp(entry.ip);
				setPingStatus((prev) => ({ ...prev, [entry.id]: result.alive ? 'alive' : 'dead' }));
				if (result.ms !== undefined) {
					setPingLatency((prev) => ({ ...prev, [entry.id]: result.ms! }));
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
					// Pick the latest one based on the folder __YYYYMMDD__ date (falling back to modified time)
					const getFolderDate = (p: string) => {
						const match = p.match(/__(\d{8})__/);
						return match ? match[1] : '00000000';
					};
					const sortByLatestFolder = (a: any, b: any) => {
						const dateDiff = getFolderDate(b.path).localeCompare(getFolderDate(a.path));
						if (dateDiff !== 0) return dateDiff;
						return new Date(b.modified).getTime() - new Date(a.modified).getTime();
					};

					let newExtractedIps: IpEntry[] = [];

					// 1. Process projectnodeservices.json
					const latestFile = nodeServicesFiles.sort(sortByLatestFolder)[0];
					if (latestFile) {
						const folderPrefix = latestFile.path.replace(/[/\\][^/\\]+$/, '');

						// Parse nodedatabase.txt if present in the same Config folder to get human-friendly gateway names
						const nodeNamesByAddress: Record<string, string> = {};
						const nodeDbFile = files.find((f: any) => f.name.toLowerCase() === 'nodedatabase.txt' && f.path.replace(/[/\\][^/\\]+$/, '') === folderPrefix);
						if (nodeDbFile) {
							try {
								const dbRes = await fetch(`/api/files/download?path=${encodeURIComponent(nodeDbFile.path)}`);
								if (dbRes.ok) {
									const dbText = await dbRes.text();
									const nodeBlocks = dbText.split(/NODE=\d+;/i);
									for (const block of nodeBlocks) {
										const addrMatch = block.match(/bNodeAddress=(0x[0-9a-fA-F]+);/);
										const nameMatch = block.match(/szName=([^;\r\n]*);/);
										if (addrMatch && nameMatch && nameMatch[1].trim()) {
											nodeNamesByAddress[addrMatch[1].toLowerCase()] = nameMatch[1].trim();
										}
									}
								}
							} catch {
								// Ignore optional nodedatabase parsing errors
							}
						}

						const jsonRes = await fetch(`/api/files/download?path=${encodeURIComponent(latestFile.path)}`);
						if (jsonRes.ok) {
							const data = await jsonRes.json();
							if (data.serverNodes && Array.isArray(data.serverNodes)) {
								const nodesWithMeta = await Promise.all(
									data.serverNodes.map(async (n: any) => {
										const logicalAddr = String(n.logicalAddress || '').toLowerCase();
										const hexCode = logicalAddr.replace(/^0x/i, '');
										const httpService = Array.isArray(n.services) ? n.services.find((s: any) => s.type === 'dt_http') : null;
										const httpPort = httpService && Number(httpService.localPort) > 0 ? Number(httpService.localPort) : 8080;

										let configuredTriggers: GatewayTriggerItem[] = [];
										if (hexCode) {
											const triggerFile = files.find(
												(f: any) => f.name.toLowerCase() === `triggersactionsconfig_${hexCode}.json` && f.path.replace(/[/\\][^/\\]+$/, '') === folderPrefix
											);
											if (triggerFile) {
												try {
													const trigRes = await fetch(`/api/files/download?path=${encodeURIComponent(triggerFile.path)}`);
													if (trigRes.ok) {
														const trigData = await trigRes.json();
														const actionsMap = new Map<string, any>();
														if (Array.isArray(trigData.actions)) {
															trigData.actions.forEach((a: any) => {
																if (a.id !== undefined) {
																	actionsMap.set(String(a.id), a);
																}
															});
														}
														if (Array.isArray(trigData.triggers)) {
															trigData.triggers.forEach((t: any) => {
																if (t.type === 'http_trigger') {
																	const rawId = t.value?.id !== undefined ? Number(t.value.id) : Number(t.id);
																	if (!Number.isNaN(rawId)) {
																		const act = t.action !== undefined ? actionsMap.get(String(t.action)) : undefined;
																		const actTarget = act?.value?.unitAddress || act?.value?.url || act?.value?.['ip-address'] || undefined;
																		configuredTriggers.push({
																			triggerId: rawId,
																			name: t.name || `Trigger #${rawId}`,
																			actionId: t.action !== undefined ? String(t.action) : undefined,
																			actionName: act?.name || undefined,
																			actionType: act?.type || undefined,
																			actionTarget: actTarget ? String(actTarget) : undefined,
																			type: t.type,
																		});
																	}
																}
															});
														}
													}
												} catch {
													// Ignore optional trigger config parsing errors
												}
											}
										}

										const dbNodeName = logicalAddr ? nodeNamesByAddress[logicalAddr] : undefined;
										const displayName = dbNodeName ? `${dbNodeName} (Node ${n.logicalAddress})` : `Node ${n.logicalAddress}`;

										return {
											id: `extracted-node-${n.logicalAddress || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15))}`,
											ip: n.localAddress || '',
											mac: n.MAC || '',
											name: displayName,
											status: 'static' as const,
											isGateway: true,
											httpPort,
											logicalAddress: n.logicalAddress,
											configuredTriggers,
										};
									})
								);
								newExtractedIps.push(...nodesWithMeta);
							}
						}
					}

					// 2. Process cameras.json
					const cameraFiles = files.filter((f: any) => f.name.toLowerCase() === 'cameras.json');
					if (cameraFiles.length > 0) {
						const latestCamFile = cameraFiles.sort(sortByLatestFolder)[0];
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

	// Combine IPs. Manual IPs overwrite extracted IPs if they have the exact same MAC or IP key.
	const { allIps, duplicateIpSet } = useMemo(() => {
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

		const list = Array.from(combinedMap.values());
		const ipCounts: Record<string, number> = {};
		for (const item of list) {
			const cleanIp = item.ip.trim();
			if (cleanIp) ipCounts[cleanIp] = (ipCounts[cleanIp] || 0) + 1;
		}
		const dupSet = new Set(Object.keys(ipCounts).filter((k) => ipCounts[k] > 1));

		return { allIps: list, duplicateIpSet: dupSet };
	}, [extractedIps, manualIps]);

	// Check each x.x.x.0-254 subnet range to see if the user is on the same local network
	useEffect(() => {
		if (allIps.length === 0 || typeof window === 'undefined') return;
		let cancelled = false;

		const subnetGroups: Record<string, IpEntry[]> = {};
		for (const entry of allIps) {
			const parts = entry.ip.trim().split('.');
			if (parts.length === 4) {
				const subnetKey = `${parts[0]}.${parts[1]}.${parts[2]}.x`;
				if (!subnetGroups[subnetKey]) subnetGroups[subnetKey] = [];
				subnetGroups[subnetKey].push(entry);
			}
		}

		// Check if window.location.hostname already matches one of the x.x.x prefixes
		const hostParts = window.location.hostname.split('.');
		if (hostParts.length === 4 && hostParts.every((p) => /^\d+$/.test(p))) {
			const hostSubnet = `${hostParts[0]}.${hostParts[1]}.${hostParts[2]}.x`;
			if (subnetGroups[hostSubnet]) {
				setReachableSubnets((prev) => ({ ...prev, [hostSubnet]: true }));
			}
		}

		// Probe gateway (.1, .254) and project IPs in each x.x.x.0-254 subnet
		Object.entries(subnetGroups).forEach(async ([subnetKey, entries]) => {
			const prefix = subnetKey.slice(0, -2); // "x.x.x"
			const deviceSample = entries.slice(0, 6);
			const gatewayIps = [`${prefix}.1`, `${prefix}.254`];

			const deviceChecks = deviceSample.map(async (entry) => {
				const res = await probeLocalIp(entry.ip, 1500);
				if (!cancelled && res.alive) {
					setReachableSubnets((prev) => (prev[subnetKey] ? prev : { ...prev, [subnetKey]: true }));
					setPingStatus((prev) => ({ ...prev, [entry.id]: 'alive' }));
					if (res.ms !== undefined) {
						setPingLatency((prev) => ({ ...prev, [entry.id]: res.ms! }));
					}
				}
				return res.alive;
			});

			const gatewayChecks = gatewayIps.map(async (gwIp) => {
				const res = await probeLocalIp(gwIp, 1500);
				if (!cancelled && res.alive) {
					setReachableSubnets((prev) => (prev[subnetKey] ? prev : { ...prev, [subnetKey]: true }));
				}
				return res.alive;
			});

			await Promise.all([...deviceChecks, ...gatewayChecks]);
		});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [allIps]);

	if (loading) {
		return (
			<div className="p-8 flex justify-center">
				<Network className="animate-pulse text-(--text-muted)" size={32} />
			</div>
		);
	}

	const q = searchQuery.toLowerCase().trim();
	const filteredIps = q
		? allIps.filter(
				(entry) =>
					entry.ip.toLowerCase().includes(q) ||
					(entry.name && entry.name.toLowerCase().includes(q)) ||
					(entry.mac && entry.mac.toLowerCase().includes(q)) ||
					entry.status.toLowerCase().includes(q)
			)
		: allIps;

	// Group by subnet (e.g. 192.168.0.x)
	const subnets: Record<string, IpEntry[]> = {};
	filteredIps.forEach((ip) => {
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

	const subnetKeys = Object.keys(subnets).sort();
	const allSubnetsOpen = subnetKeys.length > 0 && subnetKeys.every((s) => openSubnets.includes(s));

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
		<div className="flex flex-col gap-5 pb-32">
			{subnetKeys.length === 0 ? (
				<EmptyState title="No IP Addresses Found" description="Upload a DuoTecno project or manually add IPs to track them here." />
			) : (
				<div className="flex flex-col gap-4">
					{subnetKeys.map((subnet) => (
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
												{reachableSubnets[subnet] && (
													<Button variant="ghost" size="sm" onClick={() => pingAll(subnets[subnet])} icon={<Activity size={14} />} className="!h-7 text-xs">
														Ping All
													</Button>
												)}
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
																	<Input value={manualEntry.ip} onChange={(e) => updateManualIp(manualEntry.id, { ip: e.target.value })} placeholder="192.168.0.x" />
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
																<div className="w-full md:w-48 font-mono text-sm text-(--text) flex items-center gap-2">
																	<span className="opacity-50">{entry.ip.split('.').slice(0, 3).join('.')}.</span>
																	<span className="font-bold text-(--accent)">{entry.ip.split('.')[3]}</span>
																</div>
																<div className="flex-1">
																	<div className="font-medium text-(--text)">{entry.name || 'Unknown Device'}</div>
																	{entry.mac && <div className="text-xs text-(--text-muted) font-mono mt-1">{entry.mac}</div>}
																</div>
																<div className="flex items-center gap-3">
																	<div
																		className={`text-xs font-medium px-2.5 py-1 rounded-full
																		${entry.status === 'static' ? 'bg-blue-500/10 text-blue-500' : entry.status === 'free' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}
																	>
																		{entry.status.toUpperCase()}
																	</div>
																	{(!isManual || isOverride) && (
																		<div className="text-xs text-[var(--text-muted)] bg-[var(--foreground)] px-2 py-1 rounded-full">Auto</div>
																	)}

																	<div className="flex items-center gap-1">
																		<Button
																			variant="ghost"
																			size="sm"
																			onClick={() => openTriggerModal(entry)}
																			className="!px-2.5 !h-8 text-xs"
																			icon={<Zap size={15} />}
																		>
																			Trigger
																		</Button>
																		{reachableSubnets[subnet] && (
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
																		)}
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

			<Modal open={Boolean(activeGateway)} title={activeGateway ? `HTTP Triggers — ${activeGateway.name || activeGateway.ip}` : 'HTTP Triggers'} size="lg" onClose={() => setActiveGateway(null)}>
				{activeGateway &&
					(() => {
						const port = activeGateway.httpPort || 8080;
						const cleanIp = activeGateway.ip.trim();
						const triggers = activeGateway.configuredTriggers || [];
						const wildcardResp = triggerResponses['wildcard'];

						return (
							<div className="flex flex-col gap-3">
								{triggers.map((trig) => {
									const resp = triggerResponses[String(trig.triggerId)];

									return (
										<div key={trig.triggerId} className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)]/10 flex flex-col gap-2">
											<div className="flex items-center justify-between gap-2 text-xs px-0.5">
												<span className="font-semibold text-[var(--text)]">{trig.name}</span>
												{(trig.actionName || trig.actionType) && (
													<span className="text-[var(--text-muted)] truncate">
														{trig.actionName || `#${trig.actionId}`}
														{trig.actionType ? ` (${trig.actionType}${trig.actionTarget ? ` • ${trig.actionTarget}` : ''})` : ''}
													</span>
												)}
											</div>

											<div className="flex items-center gap-2">
												<div className="flex-1 min-w-0 flex items-center bg-[var(--foreground)] border border-[var(--border)]/15 rounded-xl px-3 h-10 font-mono text-xs sm:text-sm">
													<span className="text-[var(--text-muted)] truncate select-all">
														http://{cleanIp}:{port}/trigger/
													</span>
												</div>

												<div className="w-16 h-10 shrink-0 flex items-center justify-center rounded-xl bg-[var(--foreground)] border border-[var(--border)]/15 font-mono text-sm text-[var(--accent)] font-bold select-all">
													{trig.triggerId}
												</div>

												<Button
													variant="primary"
													size="sm"
													className="!h-10 shrink-0"
													onClick={() => sendTrigger(trig.triggerId, String(trig.triggerId))}
													disabled={resp?.status === 'loading'}
													icon={resp?.status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
												>
													Trigger
												</Button>
											</div>

											{resp && resp.status !== 'idle' && (
												<div
													className={`px-3 py-2 rounded-xl font-mono text-xs border ${
														resp.status === 'loading'
															? 'bg-[var(--foreground)] border-[var(--border)]/15 text-[var(--text-muted)]'
															: resp.status === 'success'
																? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
																: 'bg-red-500/10 border-red-500/30 text-red-500'
													}`}
												>
													{resp.status === 'loading' ? 'Sending...' : resp.message}
												</div>
											)}
										</div>
									);
								})}

								{/* Wildcard / Custom Trigger Entry */}
								<div className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)]/10 flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<div className="flex-1 min-w-0 flex items-center bg-[var(--foreground)] border border-[var(--border)]/15 rounded-xl px-3 h-10 font-mono text-xs sm:text-sm">
											<span className="text-[var(--text-muted)] truncate select-all">
												http://{cleanIp}:{port}/trigger/
											</span>
										</div>

										<input
											type="number"
											min={0}
											max={99}
											value={wildcardId}
											onChange={(e) => setWildcardId(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') sendTrigger(parseInt(wildcardId || '0', 10), 'wildcard');
											}}
											placeholder="0-99"
											className="w-16 h-10 shrink-0 px-2 rounded-xl bg-[var(--foreground)] border border-[var(--border)]/20 font-mono text-sm text-[var(--accent)] font-bold text-center focus:outline-none focus:border-[var(--accent)]"
										/>

										<Button
											variant="primary"
											size="sm"
											className="!h-10 shrink-0"
											onClick={() => sendTrigger(parseInt(wildcardId || '0', 10), 'wildcard')}
											disabled={wildcardResp?.status === 'loading'}
											icon={wildcardResp?.status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
										>
											Trigger
										</Button>
									</div>

									{wildcardResp && wildcardResp.status !== 'idle' && (
										<div
											className={`px-3 py-2 rounded-xl font-mono text-xs border ${
												wildcardResp.status === 'loading'
													? 'bg-[var(--foreground)] border-[var(--border)]/15 text-[var(--text-muted)]'
													: wildcardResp.status === 'success'
														? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
														: 'bg-red-500/10 border-red-500/30 text-red-500'
											}`}
										>
											{wildcardResp.status === 'loading' ? 'Sending...' : wildcardResp.message}
										</div>
									)}
								</div>
							</div>
						);
					})()}
			</Modal>
		</div>
	);
}
