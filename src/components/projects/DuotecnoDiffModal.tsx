'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Cable, CircuitBoard, GitCompare, Loader2, Minus, Network, Pencil, Plus, RefreshCw, Search, Sun, Zap } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Selector from '@/components/ui/Selector';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { linkNodeUnitsWithBindings } from '@/lib/duotecno';
import { DUOTECNO_LED_COLORS, parseLedsCfgTxt } from '@/components/projects/Controls';

export type DuotecnoVersionItem = {
	id: string;
	label: string;
	formattedDate: string;
	revision: number;
	uploader: string;
	comment: string;
};

type DiffKind = 'added' | 'removed' | 'modified';
type DiffCategory = 'nodes' | 'units' | 'bindings' | 'triggers' | 'leds' | 'topology';

type DiffEntry = {
	id: string;
	category: DiffCategory;
	kind: DiffKind;
	title: string;
	address?: string;
	before?: string;
	after?: string;
	details?: string[];
};

function normHex(val?: string | number | null): string {
	if (val === undefined || val === null) return '';
	const raw = String(val).trim().toLowerCase().replace(/;$/, '');
	if (!raw) return '';
	const num = raw.startsWith('0x') ? parseInt(raw.slice(2), 16) : /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
	if (!Number.isNaN(num)) {
		return `0x${num.toString(16).padStart(2, '0')}`;
	}
	return `0x${raw.replace(/^0x/, '').padStart(2, '0')}`;
}

function flattenTopologyModules(setup: any): Array<{ key: string; moduleId: string; physicalAddress?: string; customName?: string; pathLabel: string }> {
	const result: Array<{ key: string; moduleId: string; physicalAddress?: string; customName?: string; pathLabel: string }> = [];
	if (!Array.isArray(setup)) return result;

	const lines = Array.isArray(setup[0]) ? setup : [setup];
	lines.forEach((line: any[], lineIdx: number) => {
		const walk = (items: any[], prefix: string) => {
			if (!Array.isArray(items)) return;
			items.forEach((mod: any, idx: number) => {
				if (!mod || typeof mod !== 'object') return;
				const key = mod.physicalAddress ? `phys:${String(mod.physicalAddress).toLowerCase()}` : `inst:${mod.instanceId || `${prefix}-${idx}`}`;
				result.push({
					key,
					moduleId: String(mod.moduleId || ''),
					physicalAddress: mod.physicalAddress ? String(mod.physicalAddress) : undefined,
					customName: mod.customName ? String(mod.customName) : undefined,
					pathLabel: `${prefix} #${idx + 1}`,
				});
				if (mod.nodes && typeof mod.nodes === 'object') {
					for (const [branch, children] of Object.entries(mod.nodes)) {
						walk(children as any[], `${prefix} · Branch ${branch}`);
					}
				}
			});
		};
		walk(line, `Line ${lineIdx + 1}`);
	});

	return result;
}

function extractTriggersFromPayload(payload: any): Array<{
	key: string;
	gatewayNode: string;
	gatewayIp: string;
	httpPort: number;
	triggerId: number;
	name: string;
	actionName: string;
	actionType: string;
	actionTarget: string;
}> {
	const list: Array<{
		key: string;
		gatewayNode: string;
		gatewayIp: string;
		httpPort: number;
		triggerId: number;
		name: string;
		actionName: string;
		actionType: string;
		actionTarget: string;
	}> = [];

	const serverNodes = payload?.nodeServices?.serverNodes;
	if (!Array.isArray(serverNodes)) return list;

	for (const srvNode of serverNodes) {
		const logicalAddr = normHex(srvNode.logicalAddress);
		const hexCode = logicalAddr.replace(/^0x/, '');
		const gatewayIp = String(srvNode.localAddress || '').trim();
		const httpService = Array.isArray(srvNode.services) ? srvNode.services.find((s: any) => s.type === 'dt_http') : null;
		const httpPort = httpService && Number(httpService.localPort) > 0 ? Number(httpService.localPort) : 8080;

		const trigData = hexCode ? payload?.triggersByHex?.[hexCode] : null;
		if (!trigData) continue;

		const actionsMap = new Map<string, any>();
		if (Array.isArray(trigData.actions)) {
			trigData.actions.forEach((a: any) => {
				if (a.id !== undefined) actionsMap.set(String(a.id), a);
			});
		}

		if (Array.isArray(trigData.triggers)) {
			trigData.triggers.forEach((t: any) => {
				if (t.type !== 'http_trigger') return;
				const rawId = t.value?.id !== undefined ? Number(t.value.id) : Number(t.id);
				if (Number.isNaN(rawId)) return;
				const act = t.action !== undefined ? actionsMap.get(String(t.action)) : undefined;
				const target = act?.value?.unitAddress || act?.value?.url || act?.value?.['ip-address'] || '';
				list.push({
					key: `${logicalAddr}:trig:${rawId}`,
					gatewayNode: logicalAddr,
					gatewayIp,
					httpPort,
					triggerId: rawId,
					name: String(t.name || `Trigger #${rawId}`),
					actionName: String(act?.name || ''),
					actionType: String(act?.type || ''),
					actionTarget: String(target || ''),
				});
			});
		}
	}

	return list;
}

export default function DuotecnoDiffModal({
	open,
	onClose,
	client,
	versions,
	initialTargetVersion,
}: {
	open: boolean;
	onClose: () => void;
	client: string;
	versions: DuotecnoVersionItem[];
	initialTargetVersion?: string;
}) {
	const [baseVersion, setBaseVersion] = useState<string>('');
	const [targetVersion, setTargetVersion] = useState<string>('');
	const [baseData, setBaseData] = useState<any>(null);
	const [targetData, setTargetData] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [categoryFilter, setCategoryFilter] = useState<'all' | DiffCategory>('all');
	const [search, setSearch] = useState('');

	useEffect(() => {
		if (!open || versions.length === 0) return;
		const target = initialTargetVersion && versions.some((v) => v.id === initialTargetVersion) ? initialTargetVersion : versions[0].id;
		const targetIdx = versions.findIndex((v) => v.id === target);
		const defaultBase = versions[targetIdx + 1]?.id ?? versions[Math.min(1, versions.length - 1)]?.id ?? versions[0].id;
		setTargetVersion(target);
		setBaseVersion(defaultBase);
	}, [open, versions, initialTargetVersion]);

	useEffect(() => {
		if (!open || !client || !baseVersion || !targetVersion) return;
		let active = true;

		async function fetchBoth() {
			setLoading(true);
			try {
				const [resA, resB] = await Promise.all([
					fetch(`/api/projects/duotecno?client=${encodeURIComponent(client)}&version=${encodeURIComponent(baseVersion)}`, { cache: 'no-store' }),
					fetch(`/api/projects/duotecno?client=${encodeURIComponent(client)}&version=${encodeURIComponent(targetVersion)}`, { cache: 'no-store' }),
				]);
				const [jsonA, jsonB] = await Promise.all([resA.ok ? resA.json() : null, resB.ok ? resB.json() : null]);
				if (active) {
					setBaseData(jsonA);
					setTargetData(jsonB);
				}
			} catch (err) {
				console.error('Failed to compare Duotecno versions:', err);
			} finally {
				if (active) setLoading(false);
			}
		}

		fetchBoth();
		return () => {
			active = false;
		};
	}, [open, client, baseVersion, targetVersion]);

	const diffs = useMemo<DiffEntry[]>(() => {
		if (!baseData || !targetData) return [];
		const entries: DiffEntry[] = [];

		// 1. Compare Nodes & Units
		const baseNodes: any[] = Array.isArray(baseData?.nodeDatabase?.nodes) ? baseData.nodeDatabase.nodes : [];
		const targetNodes: any[] = Array.isArray(targetData?.nodeDatabase?.nodes) ? targetData.nodeDatabase.nodes : [];

		const baseNodesMap = new Map<string, any>();
		const targetNodesMap = new Map<string, any>();

		const baseUnitsMap = new Map<string, { unit: any; nodeName: string; nodeAddr: string }>();
		const targetUnitsMap = new Map<string, { unit: any; nodeName: string; nodeAddr: string }>();

		for (const n of baseNodes) {
			const addr = normHex(n.nodeAddress);
			if (!addr) continue;
			baseNodesMap.set(addr, n);
			for (const u of n.units || []) {
				const uAddr = `${addr};${normHex(u.unitAddress)}`;
				baseUnitsMap.set(uAddr, { unit: u, nodeName: n.name || addr, nodeAddr: addr });
			}
		}

		for (const n of targetNodes) {
			const addr = normHex(n.nodeAddress);
			if (!addr) continue;
			targetNodesMap.set(addr, n);
			for (const u of n.units || []) {
				const uAddr = `${addr};${normHex(u.unitAddress)}`;
				targetUnitsMap.set(uAddr, { unit: u, nodeName: n.name || addr, nodeAddr: addr });
			}
		}

		const allNodeAddrs = Array.from(new Set([...baseNodesMap.keys(), ...targetNodesMap.keys()])).sort();
		for (const addr of allNodeAddrs) {
			const a = baseNodesMap.get(addr);
			const b = targetNodesMap.get(addr);
			if (!a && b) {
				entries.push({
					id: `node-add-${addr}`,
					category: 'nodes',
					kind: 'added',
					title: b.name || `Node ${addr}`,
					address: addr,
					after: `${b.name || 'Unnamed'} (${b.physicalAddress || 'no physical addr'}, ${b.numberOfUnits ?? b.units?.length ?? 0} units)`,
				});
			} else if (a && !b) {
				entries.push({
					id: `node-rem-${addr}`,
					category: 'nodes',
					kind: 'removed',
					title: a.name || `Node ${addr}`,
					address: addr,
					before: `${a.name || 'Unnamed'} (${a.physicalAddress || 'no physical addr'}, ${a.numberOfUnits ?? a.units?.length ?? 0} units)`,
				});
			} else if (a && b) {
				const changes: string[] = [];
				if ((a.name || '') !== (b.name || '')) {
					changes.push(`Name: "${a.name || ''}" → "${b.name || ''}"`);
				}
				if ((a.physicalAddress || '') !== (b.physicalAddress || '')) {
					changes.push(`Physical Address: ${a.physicalAddress || 'none'} → ${b.physicalAddress || 'none'}`);
				}
				if ((a.softwareVersion || '') !== (b.softwareVersion || '')) {
					changes.push(`Firmware: ${a.softwareVersion || 'none'} → ${b.softwareVersion || 'none'}`);
				}
				if ((a.numberOfUnits ?? 0) !== (b.numberOfUnits ?? 0)) {
					changes.push(`Units count: ${a.numberOfUnits ?? 0} → ${b.numberOfUnits ?? 0}`);
				}
				if (changes.length > 0) {
					entries.push({
						id: `node-mod-${addr}`,
						category: 'nodes',
						kind: 'modified',
						title: b.name || a.name || `Node ${addr}`,
						address: addr,
						before: a.name || addr,
						after: b.name || addr,
						details: changes,
					});
				}
			}
		}

		const allUnitAddrs = Array.from(new Set([...baseUnitsMap.keys(), ...targetUnitsMap.keys()])).sort();
		for (const uAddr of allUnitAddrs) {
			const a = baseUnitsMap.get(uAddr);
			const b = targetUnitsMap.get(uAddr);
			if (!a && b) {
				entries.push({
					id: `unit-add-${uAddr}`,
					category: 'units',
					kind: 'added',
					title: `${b.unit.name || uAddr}`,
					address: uAddr,
					after: `[${b.nodeName}] ${b.unit.name || 'Unnamed'} (${b.unit.unitTypeName || `Type ${b.unit.unitType}`})`,
				});
			} else if (a && !b) {
				entries.push({
					id: `unit-rem-${uAddr}`,
					category: 'units',
					kind: 'removed',
					title: `${a.unit.name || uAddr}`,
					address: uAddr,
					before: `[${a.nodeName}] ${a.unit.name || 'Unnamed'} (${a.unit.unitTypeName || `Type ${a.unit.unitType}`})`,
				});
			} else if (a && b) {
				const nameA = (a.unit.name || '').trim();
				const nameB = (b.unit.name || '').trim();
				const typeA = a.unit.unitTypeName || String(a.unit.unitType ?? '');
				const typeB = b.unit.unitTypeName || String(b.unit.unitType ?? '');
				if (nameA !== nameB || typeA !== typeB) {
					const details: string[] = [];
					if (nameA !== nameB) details.push(`Name: "${nameA}" → "${nameB}"`);
					if (typeA !== typeB) details.push(`Type: ${typeA} → ${typeB}`);
					entries.push({
						id: `unit-mod-${uAddr}`,
						category: 'units',
						kind: 'modified',
						title: `${nameB || nameA || uAddr} (${b.nodeName})`,
						address: uAddr,
						before: nameA,
						after: nameB,
						details,
					});
				}
			}
		}

		// 2. Compare Bindings
		const baseBindings = baseData?.nodeDatabase && baseData?.bindingTxt ? linkNodeUnitsWithBindings(baseData.nodeDatabase, baseData.bindingTxt) : [];
		const targetBindings = targetData?.nodeDatabase && targetData?.bindingTxt ? linkNodeUnitsWithBindings(targetData.nodeDatabase, targetData.bindingTxt) : [];

		const formatBindingSummary = (b: any) => {
			const ins = (b.inputs || []).map((i: any) => `${i.Address || '?'} (${i.unitInfo || ''})`).join(', ');
			const outs = (b.outputs || []).map((o: any) => `${o.Address || '?'} (${o.unitInfo || ''}:${o.Event || o.Method || ''})`).join(', ');
			return `IN [${ins}] → OUT [${outs}]`;
		};

		const formatBindingRawSig = (b: any) => {
			const ins = (b.inputs || [])
				.map((i: any) => `${normHex(i.Address?.split(';')[0])};${normHex(i.Address?.split(';')[1])}:${i.Event || ''}`)
				.sort()
				.join('|');
			const outs = (b.outputs || [])
				.map((o: any) => `${normHex(o.Address?.split(';')[0])};${normHex(o.Address?.split(';')[1])}:${o.Event || o.Method || ''}:${o.Data || ''}`)
				.sort()
				.join('|');
			return `${b.Eval || ''}::${ins}=>${outs}`;
		};

		const baseBindMap = new Map<string, any>();
		const targetBindMap = new Map<string, any>();
		for (const b of baseBindings) baseBindMap.set(String((b as any).BindingNumber || b.id), b);
		for (const b of targetBindings) targetBindMap.set(String((b as any).BindingNumber || b.id), b);

		const allBindIds = Array.from(new Set([...baseBindMap.keys(), ...targetBindMap.keys()])).sort();
		for (const bId of allBindIds) {
			const a = baseBindMap.get(bId);
			const b = targetBindMap.get(bId);
			if (!a && b) {
				entries.push({
					id: `bind-add-${bId}`,
					category: 'bindings',
					kind: 'added',
					title: `Binding ${bId}`,
					address: bId,
					after: formatBindingSummary(b),
				});
			} else if (a && !b) {
				entries.push({
					id: `bind-rem-${bId}`,
					category: 'bindings',
					kind: 'removed',
					title: `Binding ${bId}`,
					address: bId,
					before: formatBindingSummary(a),
				});
			} else if (a && b && formatBindingRawSig(a) !== formatBindingRawSig(b)) {
				entries.push({
					id: `bind-mod-${bId}`,
					category: 'bindings',
					kind: 'modified',
					title: `Binding ${bId}`,
					address: bId,
					before: formatBindingSummary(a),
					after: formatBindingSummary(b),
				});
			}
		}

		// 3. Compare HTTP Triggers
		const baseTriggers = extractTriggersFromPayload(baseData);
		const targetTriggers = extractTriggersFromPayload(targetData);
		const baseTrigMap = new Map(baseTriggers.map((t) => [t.key, t]));
		const targetTrigMap = new Map(targetTriggers.map((t) => [t.key, t]));

		const allTrigKeys = Array.from(new Set([...baseTrigMap.keys(), ...targetTrigMap.keys()])).sort();
		for (const tKey of allTrigKeys) {
			const a = baseTrigMap.get(tKey);
			const b = targetTrigMap.get(tKey);
			if (!a && b) {
				entries.push({
					id: `trig-add-${tKey}`,
					category: 'triggers',
					kind: 'added',
					title: `Trigger #${b.triggerId}: ${b.name}`,
					address: `${b.gatewayIp}:${b.httpPort}/trigger/${b.triggerId}`,
					after: `${b.actionName || b.actionType || 'Action'} → ${b.actionTarget || 'N/A'}`,
				});
			} else if (a && !b) {
				entries.push({
					id: `trig-rem-${tKey}`,
					category: 'triggers',
					kind: 'removed',
					title: `Trigger #${a.triggerId}: ${a.name}`,
					address: `${a.gatewayIp}:${a.httpPort}/trigger/${a.triggerId}`,
					before: `${a.actionName || a.actionType || 'Action'} → ${a.actionTarget || 'N/A'}`,
				});
			} else if (a && b && (a.name !== b.name || a.actionName !== b.actionName || a.actionTarget !== b.actionTarget || a.gatewayIp !== b.gatewayIp || a.httpPort !== b.httpPort)) {
				const details: string[] = [];
				if (a.name !== b.name) details.push(`Trigger Name: "${a.name}" → "${b.name}"`);
				if (a.actionName !== b.actionName) details.push(`Action: "${a.actionName}" → "${b.actionName}"`);
				if (a.actionTarget !== b.actionTarget) details.push(`Target: ${a.actionTarget} → ${b.actionTarget}`);
				if (a.gatewayIp !== b.gatewayIp || a.httpPort !== b.httpPort) {
					details.push(`Gateway: ${a.gatewayIp}:${a.httpPort} → ${b.gatewayIp}:${b.httpPort}`);
				}
				entries.push({
					id: `trig-mod-${tKey}`,
					category: 'triggers',
					kind: 'modified',
					title: `Trigger #${b.triggerId}: ${b.name}`,
					address: `${b.gatewayIp}:${b.httpPort}/trigger/${b.triggerId}`,
					details,
				});
			}
		}

		// 4. Compare LED-CONFIG (ledsCfgByNode)
		const baseLedsMap: Record<string, string> = baseData?.ledsCfgByNode || {};
		const targetLedsMap: Record<string, string> = targetData?.ledsCfgByNode || {};
		const allLedNodeKeys = Array.from(new Set([...Object.keys(baseLedsMap), ...Object.keys(targetLedsMap)])).sort();

		const formatGeneralLedSummary = (raw: string, unitsMap: Map<string, { unit: any; nodeName: string; nodeAddr: string }>) => {
			const parsed = parseLedsCfgTxt(raw);
			const g = parsed.general;
			if (!g) return 'No GENERAL config';
			const colorName = DUOTECNO_LED_COLORS[g.color]?.name || 'Off';
			if (g.virtualAddress) {
				const vName = unitsMap.get(g.virtualAddress)?.unit?.name || g.virtualAddress;
				return `Dim Virtual: ${vName} (${g.virtualAddress}) · ON: ${g.levelNight * 10}% · OFF: ${g.levelDay * 10}% · Backlight: ${colorName}`;
			}
			return `No dim virtual · Static Level: ${g.level * 10}% · Backlight: ${colorName}`;
		};

		for (const hexKey of allLedNodeKeys) {
			const normAddr = normHex(`0x${hexKey.replace(/^0x/i, '')}`);
			const nodeTitle = targetNodesMap.get(normAddr)?.name || baseNodesMap.get(normAddr)?.name || `Node ${normAddr}`;
			const rawA = baseLedsMap[hexKey];
			const rawB = targetLedsMap[hexKey];

			if (!rawA && rawB) {
				entries.push({
					id: `led-add-${normAddr}`,
					category: 'leds',
					kind: 'added',
					title: `LED-CONFIG: ${nodeTitle}`,
					address: normAddr,
					after: formatGeneralLedSummary(rawB, targetUnitsMap),
				});
			} else if (rawA && !rawB) {
				entries.push({
					id: `led-rem-${normAddr}`,
					category: 'leds',
					kind: 'removed',
					title: `LED-CONFIG: ${nodeTitle}`,
					address: normAddr,
					before: formatGeneralLedSummary(rawA, baseUnitsMap),
				});
			} else if (rawA && rawB && rawA.trim() !== rawB.trim()) {
				const parsedA = parseLedsCfgTxt(rawA);
				const parsedB = parseLedsCfgTxt(rawB);
				const details: string[] = [];

				const sumA = formatGeneralLedSummary(rawA, baseUnitsMap);
				const sumB = formatGeneralLedSummary(rawB, targetUnitsMap);
				if (sumA !== sumB) {
					details.push(`General: ${sumA} → ${sumB}`);
				}

				for (let i = 0; i < 4; i++) {
					const bA = parsedA.blocks.find((x) => x.ledIndex === i);
					const bB = parsedB.blocks.find((x) => x.ledIndex === i);
					const sigA = bA ? `fn:${bA.func}|t:${bA.targetAddress || ''}|on:${bA.colorOn}|off:${bA.colorOff}|custom:${bA.hasCustomFeedback}` : 'none';
					const sigB = bB ? `fn:${bB.func}|t:${bB.targetAddress || ''}|on:${bB.colorOn}|off:${bB.colorOff}|custom:${bB.hasCustomFeedback}` : 'none';
					if (sigA !== sigB) {
						const onA = bA ? DUOTECNO_LED_COLORS[bA.colorOn]?.name || 'Off' : 'Off';
						const offA = bA ? DUOTECNO_LED_COLORS[bA.colorOff]?.name || 'Off' : 'Off';
						const onB = bB ? DUOTECNO_LED_COLORS[bB.colorOn]?.name || 'Off' : 'Off';
						const offB = bB ? DUOTECNO_LED_COLORS[bB.colorOff]?.name || 'Off' : 'Off';
						details.push(`LED #${i + 1}: [ON ${onA} / OFF ${offA} (${bA?.targetAddress || 'no target'})] → [ON ${onB} / OFF ${offB} (${bB?.targetAddress || 'no target'})]`);
					}
				}

				if (details.length > 0) {
					entries.push({
						id: `led-mod-${normAddr}`,
						category: 'leds',
						kind: 'modified',
						title: `LED-CONFIG: ${nodeTitle}`,
						address: normAddr,
						details,
					});
				}
			}
		}

		// 5. Compare Canbus Topology & Manual IPs
		const baseTopo = flattenTopologyModules(baseData?.canbusSetup);
		const targetTopo = flattenTopologyModules(targetData?.canbusSetup);
		const baseTopoMap = new Map(baseTopo.map((m) => [m.key, m]));
		const targetTopoMap = new Map(targetTopo.map((m) => [m.key, m]));

		const allTopoKeys = Array.from(new Set([...baseTopoMap.keys(), ...targetTopoMap.keys()]));
		for (const k of allTopoKeys) {
			const a = baseTopoMap.get(k);
			const b = targetTopoMap.get(k);
			if (!a && b) {
				entries.push({
					id: `topo-add-${k}`,
					category: 'topology',
					kind: 'added',
					title: `Canbus Module: ${b.customName || b.moduleId}`,
					address: b.physicalAddress || b.pathLabel,
					after: `${b.moduleId} at ${b.pathLabel}`,
				});
			} else if (a && !b) {
				entries.push({
					id: `topo-rem-${k}`,
					category: 'topology',
					kind: 'removed',
					title: `Canbus Module: ${a.customName || a.moduleId}`,
					address: a.physicalAddress || a.pathLabel,
					before: `${a.moduleId} at ${a.pathLabel}`,
				});
			} else if (a && b && (a.moduleId !== b.moduleId || a.pathLabel !== b.pathLabel || (a.customName || '') !== (b.customName || ''))) {
				const details: string[] = [];
				if (a.moduleId !== b.moduleId) details.push(`Type: ${a.moduleId} → ${b.moduleId}`);
				if (a.pathLabel !== b.pathLabel) details.push(`Position: ${a.pathLabel} → ${b.pathLabel}`);
				if ((a.customName || '') !== (b.customName || '')) details.push(`Label: "${a.customName || ''}" → "${b.customName || ''}"`);
				entries.push({
					id: `topo-mod-${k}`,
					category: 'topology',
					kind: 'modified',
					title: `Canbus Module: ${b.customName || b.moduleId}`,
					address: b.physicalAddress || b.pathLabel,
					details,
				});
			}
		}

		return entries;
	}, [baseData, targetData]);

	const counts = useMemo(() => {
		const byCat: Record<DiffCategory, number> = {
			nodes: 0,
			units: 0,
			bindings: 0,
			triggers: 0,
			leds: 0,
			topology: 0,
		};
		let added = 0;
		let removed = 0;
		let modified = 0;
		for (const d of diffs) {
			byCat[d.category]++;
			if (d.kind === 'added') added++;
			else if (d.kind === 'removed') removed++;
			else modified++;
		}
		return { byCat, added, removed, modified, total: diffs.length };
	}, [diffs]);

	const filteredDiffs = useMemo(() => {
		const q = search.trim().toLowerCase();
		return diffs.filter((d) => {
			if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
			if (!q) return true;
			return (
				d.title.toLowerCase().includes(q) ||
				(d.address && d.address.toLowerCase().includes(q)) ||
				(d.before && d.before.toLowerCase().includes(q)) ||
				(d.after && d.after.toLowerCase().includes(q)) ||
				(d.details && d.details.some((line) => line.toLowerCase().includes(q)))
			);
		});
	}, [diffs, categoryFilter, search]);

	const versionOptions = versions.map((v) => ({
		label: v.label,
		value: v.id,
	}));

	return (
		<Modal open={open} onClose={onClose} title="Duotecno Version Comparison & Changelog" size="xl">
			<div className="space-y-5">
				{/* Version Selectors */}
				<div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 rounded-2xl bg-(--background) border border-(--border)/10">
					<div className="space-y-1">
						<div className="text-xs font-medium text-(--text-muted)">Base Version (From)</div>
						<Selector value={baseVersion} options={versionOptions} onChange={setBaseVersion} />
					</div>
					<div className="hidden md:flex items-center justify-center pt-5 text-(--text-muted)">
						<ArrowRight size={20} />
					</div>
					<div className="space-y-1">
						<div className="text-xs font-medium text-(--text-muted)">Target Version (To)</div>
						<Selector value={targetVersion} options={versionOptions} onChange={setTargetVersion} />
					</div>
				</div>

				{/* Summary Pills & Search */}
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
						{(
							[
								{ id: 'all', label: `All (${counts.total})`, icon: <GitCompare size={14} /> },
								{ id: 'nodes', label: `Nodes (${counts.byCat.nodes})`, icon: <CircuitBoard size={14} /> },
								{ id: 'units', label: `Units (${counts.byCat.units})`, icon: <Pencil size={14} /> },
								{ id: 'bindings', label: `Bindings (${counts.byCat.bindings})`, icon: <RefreshCw size={14} /> },
								{ id: 'triggers', label: `HTTP Triggers (${counts.byCat.triggers})`, icon: <Zap size={14} /> },
								{ id: 'leds', label: `LED-CONFIG (${counts.byCat.leds})`, icon: <Sun size={14} /> },
								{ id: 'topology', label: `Topology (${counts.byCat.topology})`, icon: <Cable size={14} /> },
							] as const
						).map((tab) => {
							const active = categoryFilter === tab.id;
							return (
								<button
									key={tab.id}
									onClick={() => setCategoryFilter(tab.id)}
									className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
										active ? 'bg-(--accent) text-white shadow-sm' : 'bg-(--background) text-(--text-muted) hover:text-(--text) border border-(--border)/10'
									}`}
								>
									{tab.icon}
									{tab.label}
								</button>
							);
						})}
					</div>

					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2 text-xs font-semibold">
							<span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">+{counts.added}</span>
							<span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">~{counts.modified}</span>
							<span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">-{counts.removed}</span>
						</div>
						<div className="w-56">
							<Input placeholder="Filter changes..." value={search} onChange={(e) => setSearch(e.target.value)} />
						</div>
					</div>
				</div>

				{/* Diff List */}
				<div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
					{loading ? (
						<div className="py-16 flex flex-col items-center justify-center gap-3 text-(--text-muted)">
							<Loader2 size={28} className="animate-spin text-(--accent)" />
							<span className="text-sm">Comparing Duotecno versions...</span>
						</div>
					) : baseVersion === targetVersion ? (
						<div className="py-12 text-center text-sm text-(--text-muted) bg-(--background) rounded-2xl border border-(--border)/10">
							Select two different versions above to inspect changes between them.
						</div>
					) : filteredDiffs.length === 0 ? (
						<div className="py-12 text-center text-sm text-(--text-muted) bg-(--background) rounded-2xl border border-(--border)/10">No differences found for the selected filter.</div>
					) : (
						filteredDiffs.map((item) => {
							const badgeStyle =
								item.kind === 'added'
									? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
									: item.kind === 'removed'
										? 'bg-red-500/15 text-red-500 border-red-500/30'
										: 'bg-amber-500/15 text-amber-500 border-amber-500/30';

							const badgeIcon = item.kind === 'added' ? <Plus size={12} /> : item.kind === 'removed' ? <Minus size={12} /> : <Pencil size={12} />;

							return (
								<div key={item.id} className="p-3.5 rounded-xl bg-(--background) border border-(--border)/10 space-y-1.5">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex items-center gap-2.5">
											<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}>
												{badgeIcon}
												{item.kind === 'added' ? 'Added' : item.kind === 'removed' ? 'Removed' : 'Modified'}
											</span>
											<span className="text-xs uppercase tracking-wider font-semibold text-(--text-muted)">{item.category}</span>
											<span className="font-medium text-sm">{item.title}</span>
										</div>
										{item.address && <code className="text-xs px-2 py-0.5 rounded bg-(--foreground) text-(--text-muted)">{item.address}</code>}
									</div>

									{item.details && item.details.length > 0 ? (
										<ul className="text-xs text-(--text-muted) space-y-1 pl-2 border-l-2 border-(--border)/20">
											{item.details.map((line, i) => (
												<li key={i}>{line}</li>
											))}
										</ul>
									) : (
										<div className="text-xs text-(--text-muted) space-y-1">
											{item.before && <div className="text-red-400/90 line-through break-all">{item.before}</div>}
											{item.after && <div className="text-emerald-400/90 break-all">{item.after}</div>}
										</div>
									)}
								</div>
							);
						})
					)}
				</div>

				<div className="flex justify-end">
					<Button variant="secondary" onClick={onClose}>
						Close
					</Button>
				</div>
			</div>
		</Modal>
	);
}
