'use client';

import { Info, Pointer, SunDim, Zap, Hand, Sun, Search, Filter, X, Loader2 } from 'lucide-react';
import { useEffect, useState, useMemo, useRef } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { linkNodeUnitsWithBindings } from '@/lib/duotecno';
import { ReactSVG } from 'react-svg';

type HttpTriggerLink = {
	gatewayIp: string;
	httpPort: number;
	nodeAddress: string;
	unitAddress: string;
	fullAddress: string; // normalized "0xfc;0x9c"
	triggerId: number;
	triggerName: string;
	actionName?: string;
	actionType?: string;
	targetOutputs: Set<string>; // normalized "0x07;0x00" output addresses driven by this virtual unit
};

type LedBlockConfig = {
	ledIndex: number;
	func: number;
	unitType?: number;
	targetAddress?: string;
	feedbackType?: string;
	hasCustomFeedback: boolean;
	colorOn: number;
	colorOff: number;
};

type LedGeneralConfig = {
	color: number;
	level: number;
	cfgData: number;
	type: number;
	virtualAddress?: string;
	levelDay: number;
	levelNight: number;
};

export type NodeLedConfig = {
	general: LedGeneralConfig | null;
	blocks: LedBlockConfig[];
};

type LedTemplateConfig = Record<string, { colorOn: number; colorOff: number }>;

export const DUOTECNO_LED_COLORS: Record<number, { name: string; hex: string; glow: string; border: string; bg: string }> = {
	1: { name: 'Red', hex: '#ef4444', glow: '0 0 14px rgba(239, 68, 68, 0.85)', border: 'rgba(239, 68, 68, 0.65)', bg: 'rgba(239, 68, 68, 0.14)' },
	2: { name: 'Green', hex: '#22c55e', glow: '0 0 14px rgba(34, 197, 94, 0.85)', border: 'rgba(34, 197, 94, 0.65)', bg: 'rgba(34, 197, 94, 0.14)' },
	3: { name: 'Blue', hex: '#3b82f6', glow: '0 0 14px rgba(59, 130, 246, 0.85)', border: 'rgba(59, 130, 246, 0.65)', bg: 'rgba(59, 130, 246, 0.14)' },
	4: { name: 'Yellow', hex: '#eab308', glow: '0 0 14px rgba(234, 179, 8, 0.85)', border: 'rgba(234, 179, 8, 0.65)', bg: 'rgba(234, 179, 8, 0.14)' },
	5: { name: 'Purple', hex: '#a855f7', glow: '0 0 14px rgba(168, 85, 247, 0.85)', border: 'rgba(168, 85, 247, 0.65)', bg: 'rgba(168, 85, 247, 0.14)' },
	6: { name: 'White', hex: '#ffffff', glow: '0 0 14px rgba(255, 255, 255, 0.95), 0 0 6px rgba(148, 163, 184, 0.8)', border: 'rgba(228, 228, 231, 0.85)', bg: 'rgba(255, 255, 255, 0.16)' },
	7: { name: 'Cyan', hex: '#06b6d4', glow: '0 0 14px rgba(6, 182, 212, 0.85)', border: 'rgba(6, 182, 212, 0.65)', bg: 'rgba(6, 182, 212, 0.14)' },
	8: { name: 'Orange', hex: '#f97316', glow: '0 0 14px rgba(249, 115, 22, 0.85)', border: 'rgba(249, 115, 22, 0.65)', bg: 'rgba(249, 115, 22, 0.14)' },
};

function parseLedTemplateTxt(content: string): LedTemplateConfig {
	const result: LedTemplateConfig = {};
	let currentSection = '';
	let colorOn = 6;
	let colorOff = 0;

	const flush = () => {
		if (currentSection) {
			result[currentSection] = { colorOn, colorOff };
		}
	};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim().replace(/;$/, '');
		if (!line || line.startsWith(';')) continue;
		const [k, v] = line.split('=');
		if (!k || v === undefined) continue;
		const key = k.trim();
		const val = v.trim();

		if (key.startsWith('FDBK_')) {
			flush();
			currentSection = key;
			colorOn = 6;
			colorOff = 0;
		} else if (key === 'ColorOn' || key === 'ColorActive' || key === 'ColorBusyUp' || key === 'ColorHeating') {
			const n = parseInt(val.split(';')[0], 10);
			if (!Number.isNaN(n)) colorOn = n;
		} else if (key === 'ColorPreset' || key === 'ColorSrc') {
			const n = parseInt(val.split(';')[0], 10);
			if (!Number.isNaN(n)) colorOn = n;
		} else if (key === 'ColorOff' || key === 'ColorIdle' || key === 'ColorStable') {
			const n = parseInt(val.split(';')[0], 10);
			if (!Number.isNaN(n)) colorOff = n;
		}
	}
	flush();
	return result;
}

export function parseLedsCfgTxt(content: string): NodeLedConfig {
	const blocks: LedBlockConfig[] = [];
	let general: LedGeneralConfig | null = null;
	let inGeneral = false;
	let genNodeAddr = '';
	let genUnitAddr = '';

	let current: Partial<LedBlockConfig> | null = null;
	let nodeAddr = '';
	let unitAddr = '';

	const flushGeneral = () => {
		if (inGeneral && general) {
			const normNode = normalizeHexPart(genNodeAddr);
			const normUnit = normalizeHexPart(genUnitAddr);
			if (general.type !== 255 && normNode && normUnit && normNode !== '0xff' && normUnit !== '0xff') {
				general.virtualAddress = `${normNode};${normUnit}`;
			}
			inGeneral = false;
		}
	};

	const flush = () => {
		flushGeneral();
		if (current && current.ledIndex !== undefined) {
			const normNode = normalizeHexPart(nodeAddr);
			const normUnit = normalizeHexPart(unitAddr);
			const targetAddress = normNode && normUnit && normNode !== '0xff' && normUnit !== '0xff' ? `${normNode};${normUnit}` : undefined;
			blocks.push({
				ledIndex: current.ledIndex,
				func: current.func ?? 0,
				unitType: current.unitType,
				targetAddress,
				feedbackType: current.feedbackType,
				hasCustomFeedback: Boolean(current.hasCustomFeedback),
				colorOn: current.colorOn ?? 6,
				colorOff: current.colorOff ?? 0,
			});
		}
	};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim().replace(/;$/, '');
		if (!line || line.startsWith(';')) continue;
		const [k, v] = line.split('=');
		if (!k || v === undefined) continue;
		const key = k.trim();
		const val = v.trim();

		if (key === 'GENERAL') {
			flush();
			current = null;
			inGeneral = true;
			general = {
				color: 0,
				level: 8,
				cfgData: 0,
				type: 255,
				levelDay: 10,
				levelNight: 0,
			};
			genNodeAddr = '';
			genUnitAddr = '';
			continue;
		}
		if (key === 'LED') {
			flush();
			current = { ledIndex: parseInt(val, 10), func: 0, hasCustomFeedback: false, colorOn: 6, colorOff: 0 };
			nodeAddr = '';
			unitAddr = '';
			continue;
		}

		if (inGeneral && general) {
			if (key === 'Color') general.color = parseInt(val, 10) || 0;
			else if (key === 'Level') {
				const n = parseInt(val, 10);
				if (!Number.isNaN(n)) general.level = n;
			} else if (key === 'CfgData') general.cfgData = parseInt(val, 10) || 0;
			else if (key === 'Type') {
				const n = parseInt(val, 10);
				if (!Number.isNaN(n)) general.type = n;
			} else if (key === 'NodeAddress') genNodeAddr = val;
			else if (key === 'UnitAddress') genUnitAddr = val;
			else if (key === 'LevelDay') {
				const n = parseInt(val, 10);
				if (!Number.isNaN(n)) general.levelDay = n;
			} else if (key === 'LevelNight') {
				const n = parseInt(val, 10);
				if (!Number.isNaN(n)) general.levelNight = n;
			}
			continue;
		}

		if (!current) continue;

		if (key === 'Function') {
			current.func = parseInt(val, 10) || 0;
		} else if (key === 'Type') {
			const n = parseInt(val, 10);
			if (!Number.isNaN(n)) current.unitType = n;
		} else if (key === 'NodeAddress') {
			nodeAddr = val;
		} else if (key === 'UnitAddress') {
			unitAddr = val;
		} else if (key.startsWith('FDBK_')) {
			current.feedbackType = key;
			if (parseInt(val, 10) === 1) {
				current.hasCustomFeedback = true;
			}
		} else if (key === 'ColorOn' || key === 'ColorActive' || key === 'ColorUp' || key === 'ColorBusyUp') {
			const n = parseInt(val.split(';')[0], 10);
			if (!Number.isNaN(n) && (n > 0 || key === 'ColorOn' || key === 'ColorActive')) {
				current.colorOn = n;
			}
		} else if (key === 'ColorSrc' || key === 'ColorPreset') {
			const n = parseInt(val.split(';')[0], 10);
			if (!Number.isNaN(n)) current.colorOn = n;
		} else if (key === 'ColorOff' || key === 'ColorIdle') {
			const n = parseInt(val.split(';')[0], 10);
			if (!Number.isNaN(n)) current.colorOff = n;
		}
	}
	flush();
	return { general, blocks };
}

function normalizeHexPart(part: string): string {
	const clean = part.trim().toLowerCase().replace(/^0x/, '');
	if (!clean) return '';
	return `0x${clean.padStart(2, '0')}`;
}

function normalizeDuotecnoAddr(addr?: string): string {
	if (!addr) return '';
	const parts = addr.trim().replace(/;$/, '').split(';');
	if (parts.length < 2) return addr.trim().toLowerCase();
	return `${normalizeHexPart(parts[0])};${normalizeHexPart(parts[1])}`;
}

type CachedControlsData = {
	nodes: any[];
	bindings: any[];
	httpTriggers: HttpTriggerLink[];
	ledTemplate: LedTemplateConfig;
	ledsByNode: Record<string, NodeLedConfig>;
	projectSetup: any;
};

const controlsDataCache = new Map<string, CachedControlsData>();

export default function Controls({ basePath, client, version, onActionsChange }: { basePath: string; client: string; version?: string; onActionsChange?: (actions: any) => void }) {
	const cacheKey = `${client}::${version || 'latest'}`;
	const cached = controlsDataCache.get(cacheKey);
	const [projectSetup, setProjectSetup] = useState<any>(cached?.projectSetup ?? null);
	const [loading, setLoading] = useState(!cached);
	const [printing, setPrinting] = useState(false);
	const [nodesData, setNodesData] = useState<any[]>(cached?.nodes ?? []);
	const [bindingsData, setBindingsData] = useState<any[]>(cached?.bindings ?? []);
	const [httpTriggers, setHttpTriggers] = useState<HttpTriggerLink[]>(cached?.httpTriggers ?? []);
	const [ledTemplate, setLedTemplate] = useState<LedTemplateConfig>(cached?.ledTemplate ?? {});
	const [ledsByNode, setLedsByNode] = useState<Record<string, NodeLedConfig>>(cached?.ledsByNode ?? {});
	const [activeQuadrants, setActiveQuadrants] = useState<Record<string, boolean>>({});
	const [dimVirtualStates, setDimVirtualStates] = useState<Record<string, boolean>>({});
	const activeControllersRef = useRef<Record<string, AbortController>>({});
	const [triggerStatus, setTriggerStatus] = useState<
		Record<
			string,
			{
				status: 'idle' | 'loading' | 'success' | 'error';
				message?: string;
			}
		>
	>({});
	const [bindingsModal, setBindingsModal] = useState<any | null>(null);
	const [focusedChannel, setFocusedChannel] = useState<number | null>(null);

	// Search & Filter state
	const [searchQuery, setSearchQuery] = useState('');
	const [onlyConfigured, setOnlyConfigured] = useState(false);

	useEffect(() => {
		onActionsChange?.({
			print: handlePrint,
			printing,
		});
	}, [printing, onActionsChange]);

	const handlePrint = () => {
		const grid = document.getElementById('controls-grid');
		if (!grid) return;

		setPrinting(true);

		try {
			const tiler = document.createElement('div');
			tiler.id = 'print-tiler';
			tiler.style.cssText = 'position: absolute; top: 0; left: 0; z-index: -100; opacity: 0; pointer-events: none; width: 100%;';

			const clone = grid.cloneNode(true) as HTMLElement;
			clone.className = 'grid grid-cols-4 gap-3 w-full items-start';
			tiler.appendChild(clone);
			document.body.appendChild(tiler);

			const style = document.createElement('style');
			style.innerHTML = `
				@page { size: A3 landscape; margin: 8mm; }
				@media print {
					body {
						margin: 0 !important;
						padding: 0 !important;
						background: white !important;
					}
					body > *:not(#print-tiler) { display: none !important; }
					#print-tiler { 
						display: block !important; 
						position: static !important; 
						opacity: 1 !important; 
						z-index: 10000 !important; 
					}
					#print-tiler * {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
						color-adjust: exact !important;
					}
				}
			`;
			document.head.appendChild(style);

			setTimeout(() => {
				window.print();
				setTimeout(() => {
					document.head.removeChild(style);
					document.body.removeChild(tiler);
					setPrinting(false);
				}, 1000);
			}, 100);
		} catch (e) {
			console.error('Print failed', e);
			setPrinting(false);
		}
	};

	useEffect(() => {
		let isMounted = true;

		async function load() {
			try {
				if (!controlsDataCache.has(cacheKey)) {
					setLoading(true);
				}

				const versionParam = version ? `&version=${encodeURIComponent(version)}` : '';
				const res = await fetch(`/api/projects/duotecno?client=${encodeURIComponent(client)}${versionParam}`, { cache: 'no-store' });
				if (!res.ok) return;
				const payload = await res.json();

				const nodeDatabase = payload.nodeDatabase;
				const bindingTxt = payload.bindingTxt || '';
				const canbusSetup = payload.canbusSetup ?? null;

				if (!nodeDatabase) return;

				const linkedBindings = linkNodeUnitsWithBindings(nodeDatabase, bindingTxt);

				const discoveredTriggers: HttpTriggerLink[] = [];
				let parsedTemplate: LedTemplateConfig = {};
				const parsedLedsByNode: Record<string, NodeLedConfig> = {};

				try {
					if (payload.ledTemplateTxt) {
						parsedTemplate = parseLedTemplateTxt(payload.ledTemplateTxt);
					}
					if (payload.ledsCfgByNode && typeof payload.ledsCfgByNode === 'object') {
						for (const [nodeKey, txt] of Object.entries(payload.ledsCfgByNode)) {
							if (typeof txt === 'string' && txt) {
								parsedLedsByNode[nodeKey] = parseLedsCfgTxt(txt);
							}
						}
					}

					const nsData = payload.nodeServices;
					if (Array.isArray(nsData?.serverNodes)) {
						for (const srvNode of nsData.serverNodes) {
							const logicalAddr = normalizeHexPart(String(srvNode.logicalAddress || ''));
							const hexCode = logicalAddr.replace(/^0x/, '');
							const gatewayIp = String(srvNode.localAddress || '').trim();
							if (!hexCode || !gatewayIp) continue;

							const httpService = Array.isArray(srvNode.services) ? srvNode.services.find((s: any) => s.type === 'dt_http') : null;
							const httpPort = httpService && Number(httpService.localPort) > 0 ? Number(httpService.localPort) : 8080;

							const trigData = payload.triggersByHex?.[hexCode];
							if (!trigData) continue;

							const moodOutputsByUnit: Record<string, Set<string>> = {};
							const moodTxt = payload.moodsByHex?.[hexCode];
							if (typeof moodTxt === 'string' && moodTxt) {
								let currentMoodUnit = '';
								for (const rawLine of moodTxt.split(/\r?\n/)) {
									const line = rawLine.trim();
									const moodMatch = line.match(/^MOOD=(0x[0-9a-fA-F]+);/i);
									if (moodMatch) {
										currentMoodUnit = normalizeHexPart(moodMatch[1]);
										if (!moodOutputsByUnit[currentMoodUnit]) {
											moodOutputsByUnit[currentMoodUnit] = new Set();
										}
										continue;
									}
									const entryMatch = line.match(/^entry=([0-9a-fA-F]{2})([0-9a-fA-F]{2})/i);
									if (entryMatch && currentMoodUnit) {
										const outAddr = `0x${entryMatch[1].toLowerCase()};0x${entryMatch[2].toLowerCase()}`;
										moodOutputsByUnit[currentMoodUnit].add(outAddr);
									}
								}
							}

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
									const rawUnitAddr = act?.value?.unitAddress;
									if (!rawUnitAddr) return;

									const normUnitAddr = normalizeHexPart(String(rawUnitAddr));
									const fullAddress = `${logicalAddr};${normUnitAddr}`;
									const targetOutputs = new Set<string>();

									linkedBindings.forEach((b: any) => {
										const hasVirtualInput = (b.inputs || []).some((inp: any) => normalizeDuotecnoAddr(inp.Address) === fullAddress);
										if (hasVirtualInput) {
											(b.outputs || []).forEach((out: any) => {
												const normOut = normalizeDuotecnoAddr(out.Address);
												if (normOut) targetOutputs.add(normOut);
											});
										}
									});

									const moodTargets = moodOutputsByUnit[normUnitAddr];
									if (moodTargets) {
										moodTargets.forEach((addr) => targetOutputs.add(addr));
									}

									discoveredTriggers.push({
										gatewayIp,
										httpPort,
										nodeAddress: logicalAddr,
										unitAddress: normUnitAddr,
										fullAddress,
										triggerId: rawId,
										triggerName: t.name || `http${rawId}`,
										actionName: act?.name || undefined,
										actionType: act?.type || undefined,
										targetOutputs,
									});
								});
							}
						}
					}
				} catch {
					// Ignore optional trigger discovery errors
				}

				const nextData: CachedControlsData = {
					nodes: nodeDatabase.nodes ?? [],
					bindings: linkedBindings,
					httpTriggers: discoveredTriggers,
					ledTemplate: parsedTemplate,
					ledsByNode: parsedLedsByNode,
					projectSetup: canbusSetup,
				};
				controlsDataCache.set(cacheKey, nextData);

				if (isMounted) {
					setNodesData(nextData.nodes);
					setBindingsData(nextData.bindings);
					setHttpTriggers(nextData.httpTriggers);
					setLedTemplate(nextData.ledTemplate);
					setLedsByNode(nextData.ledsByNode);
					setProjectSetup(nextData.projectSetup);
				}
			} catch (err) {
				console.error('Error loading controls data:', err);
			} finally {
				if (isMounted) setLoading(false);
			}
		}

		load();

		return () => {
			isMounted = false;
		};
	}, [basePath, client, version, cacheKey]);

	const allModules: any[] = useMemo(() => {
		const list: any[] = [];
		if (projectSetup) {
			const extract = (node: any) => {
				if (Array.isArray(node)) {
					for (const child of node) extract(child);
				} else if (node) {
					list.push(node);
					if (node.nodes) {
						for (const branch of Object.values(node.nodes)) {
							extract(branch);
						}
					}
				}
			};
			extract(projectSetup);
		}
		return list;
	}, [projectSetup]);

	const hasExplicitButtons = useMemo(() => allModules.some((m) => ['DTBS-4x', 'DT1ET-4x', 'DT1C-4x'].includes(m.moduleId)), [allModules]);

	// Helper to resolve the 4 physical button quadrant units (indices 0=LB, 1=LO, 2=RB, 3=RO)
	const getQuadrantUnit = (node: any, idx: number) => {
		if (!node || !Array.isArray(node.units)) return undefined;
		const quadrantNames = ['LB', 'LO', 'RB', 'RO'];
		const targetName = quadrantNames[idx];
		if (targetName) {
			const byName = node.units.find((u: any) => (u.name || '').trim().toUpperCase() === targetName);
			if (byName) return byName;
		}
		const offset = node.units[0]?.unitTypeName === 'Sens' ? 1 : 0;
		return node.units[idx + offset];
	};

	// Normalize switches into a unified list of { key, name, physicalAddress, node }
	const switchEntries = useMemo(() => {
		if (hasExplicitButtons) {
			return allModules
				.filter((module) => ['DTBS-4x', 'DT1ET-4x', 'DT1C-4x'].includes(module.moduleId))
				.map((button) => {
					const node = nodesData.find((n) => n.physicalAddress === button.physicalAddress);
					return {
						key: button.instanceId || button.physicalAddress,
						name: node ? node.name : button.physicalAddress,
						physicalAddress: button.physicalAddress,
						node,
					};
				});
		}

		return nodesData
			.filter((node) => {
				const units = node.units || [];
				// Exclude DIN modules / Smartboxes / Subboxes that have Relais, Dimmer, Motor, Virtual, or Audio units, or >6 total units
				const hasDinOrVirtualUnits = units.some((u: any) => ['Relais', 'Dimmer', 'Motor', 'Virtual', 'Audio', 'Audio Matrix', 'TX'].includes(u.unitTypeName));
				if (hasDinOrVirtualUnits || units.length > 6) return false;

				const hasAllQuadrantNames = ['LB', 'LO', 'RB', 'RO'].every((qName) => units.some((u: any) => (u.name || '').trim().toUpperCase() === qName));
				if (hasAllQuadrantNames) return true;
				if (node.nodeTypeName !== 'Std. Node') return false;
				const controlCount = units.filter((u: any) => u.unitTypeName === 'Control').length;
				return controlCount === 4;
			})
			.map((node, index) => ({
				key: node.physicalAddress || String(index),
				name: node.name || node.physicalAddress,
				physicalAddress: node.physicalAddress,
				node,
			}));
	}, [hasExplicitButtons, allModules, nodesData]);

	// Pre-index bindings by normalized input address ("0x08;0x00") for O(1) lookup per quadrant
	const bindingsByInputAddr = useMemo(() => {
		const map = new Map<string, any[]>();
		for (const b of bindingsData) {
			if (!Array.isArray(b.inputs)) continue;
			for (const inp of b.inputs) {
				const addr = normalizeDuotecnoAddr(inp.Address);
				if (!addr) continue;
				const list = map.get(addr);
				if (list) {
					list.push(b);
				} else {
					map.set(addr, [b]);
				}
			}
		}
		return map;
	}, [bindingsData]);

	// Helper to inspect a switch's 4 quadrants (indices 0, 1, 2, 3)
	const getUnitBindingsForIdx = (node: any, idx: number) => {
		const unit = getQuadrantUnit(node, idx);
		if (!node || !unit) return [];
		const addrKey = normalizeDuotecnoAddr(`${node.nodeAddress};${unit.unitAddress}`);
		return bindingsByInputAddr.get(addrKey) || [];
	};

	// Map normalized "0xfc;0x0c" -> { name, nodeName, unitTypeName }
	const unitByAddress = useMemo(() => {
		const map = new Map<string, { name: string; nodeName: string; unitTypeName: string }>();
		for (const n of nodesData) {
			for (const u of n.units || []) {
				const addr = normalizeDuotecnoAddr(`${n.nodeAddress};${u.unitAddress}`);
				if (addr) {
					map.set(addr, {
						name: (u.name || '').trim() || addr,
						nodeName: (n.name || '').trim() || String(n.nodeAddress || ''),
						unitTypeName: u.unitTypeName || '',
					});
				}
			}
		}
		return map;
	}, [nodesData]);

	const getSwitchGeneralLedConfig = (node: any): (LedGeneralConfig & { virtualName?: string }) | null => {
		const nodeKey = normalizeHexPart(String(node?.nodeAddress || ''));
		const general = ledsByNode[nodeKey]?.general;
		if (!general) return null;
		const virtualName = general.virtualAddress ? unitByAddress.get(general.virtualAddress)?.name : undefined;
		return {
			...general,
			virtualName,
		};
	};

	// Resolve LED feedback { colorOn, colorOff, feedbackType, targetAddress, targetName, isCustom, func } for a switch quadrant
	const getQuadrantLedFeedback = (
		node: any,
		idx: number,
		unitBindings: any[]
	): {
		colorOn: number;
		colorOff: number;
		feedbackType?: string;
		targetAddress?: string;
		targetName?: string;
		isCustom: boolean;
		func: number;
	} => {
		const nodeKey = normalizeHexPart(String(node?.nodeAddress || ''));
		const nodeLeds = ledsByNode[nodeKey]?.blocks || [];
		// DuoTecno LED indices: LED=0 is LB (idx 0), LED=1 is RB (idx 2), LED=2 is LO (idx 1), LED=3 is RO (idx 3)
		const ledIdx = idx === 1 ? 2 : idx === 2 ? 1 : idx;

		const bindingOutputAddrs = new Set(unitBindings.flatMap((b) => (b.outputs || []).map((o: any) => normalizeDuotecnoAddr(o.Address)).filter(Boolean)));

		const ledBlock = nodeLeds.find((b) => b.ledIndex === ledIdx) || nodeLeds.find((b) => b.targetAddress && bindingOutputAddrs.has(b.targetAddress));
		const targetName = ledBlock?.targetAddress ? unitByAddress.get(ledBlock.targetAddress)?.name : undefined;

		if (ledBlock && ledBlock.func > 0 && ledBlock.hasCustomFeedback) {
			return {
				colorOn: ledBlock.colorOn,
				colorOff: ledBlock.colorOff,
				feedbackType: ledBlock.feedbackType,
				targetAddress: ledBlock.targetAddress,
				targetName,
				isCustom: true,
				func: ledBlock.func,
			};
		}

		// Fall back to LEDConfigSelectedTemplate -> LEDConfigTemplate,<name>.txt
		const sectionKey = ledBlock?.feedbackType || 'FDBK_SWITCH';
		const tpl = ledTemplate[sectionKey] || ledTemplate.FDBK_SWITCH || ledTemplate.FDBK_DIMMER || ledTemplate.FDBK_TACTILE;

		if (tpl) {
			return {
				colorOn: tpl.colorOn,
				colorOff: tpl.colorOff,
				feedbackType: ledBlock?.feedbackType,
				targetAddress: ledBlock?.targetAddress,
				targetName,
				isCustom: false,
				func: ledBlock?.func ?? 0,
			};
		}

		return {
			colorOn: 6,
			colorOff: 0,
			feedbackType: ledBlock?.feedbackType,
			targetAddress: ledBlock?.targetAddress,
			targetName,
			isCustom: false,
			func: ledBlock?.func ?? 0,
		};
	};

	const getOutputsForBinding = (b: any) => {
		const bindingName = (b.BindingStrName || '').replace(/['"]/g, '');
		if (b.outputs && b.outputs.length > 0) {
			return Array.from(
				new Set(
					b.outputs.map((out: any) => {
						let name = out.unitInfo || '';
						if (name.includes('Unit: ')) name = name.split('Unit: ')[1];
						return name.replace(/^,/, '').trim();
					})
				)
			) as string[];
		}
		return [bindingName.replace(/\s+[PLS]$/i, '')];
	};

	const getHttpTriggersForBinding = (b: any): HttpTriggerLink[] => {
		if (!b || httpTriggers.length === 0) return [];
		const bInputs = (b.inputs || []).map((i: any) => normalizeDuotecnoAddr(i.Address)).filter(Boolean);
		const bOutputs = (b.outputs || []).map((o: any) => normalizeDuotecnoAddr(o.Address)).filter(Boolean);

		return httpTriggers.filter((trig) => {
			if (bInputs.includes(trig.fullAddress) || bOutputs.includes(trig.fullAddress)) return true;
			return bOutputs.some((outAddr: string) => trig.targetOutputs.has(outAddr));
		});
	};

	const fireHttpTrigger = (trig: HttpTriggerLink, e?: React.MouseEvent) => {
		e?.stopPropagation();
		const gatewayKey = `${trig.gatewayIp}:${trig.httpPort}`;
		const key = `${gatewayKey}/${trig.triggerId}`;
		const url = `http://${gatewayKey}/trigger/${trig.triggerId}`;

		// Abort any previous open socket to this gateway so the Smartbox single-connection listener is freed immediately
		if (activeControllersRef.current[gatewayKey]) {
			activeControllersRef.current[gatewayKey].abort();
		}

		const controller = new AbortController();
		activeControllersRef.current[gatewayKey] = controller;
		const timeoutId = setTimeout(() => controller.abort(), 1500);
		const start = performance.now();

		setTriggerStatus((prev) => ({
			...prev,
			[key]: {
				status: 'success',
				message: `200 OK — Trigger #${trig.triggerId} sent`,
			},
		}));

		fetch(url, {
			mode: 'no-cors',
			cache: 'no-store',
			signal: controller.signal,
		})
			.then(async (res) => {
				clearTimeout(timeoutId);
				const ms = Math.max(1, Math.round(performance.now() - start));
				let bodyText = '';
				try {
					if (res.type !== 'opaque') {
						bodyText = await res.text();
					}
				} catch {
					// Ignore opaque response body read errors
				}
				setTriggerStatus((prev) => ({
					...prev,
					[key]: {
						status: 'success',
						message: bodyText.trim() || `200 OK — Trigger #${trig.triggerId} sent (${ms}ms)`,
					},
				}));
			})
			.catch((err: any) => {
				clearTimeout(timeoutId);
				if (err?.name === 'AbortError') {
					// On DuoTecno Smartbox, the GET packet is processed immediately in <10ms even if the HTTP socket stays open
					return;
				}
				const ms = Math.max(1, Math.round(performance.now() - start));
				setTriggerStatus((prev) => ({
					...prev,
					[key]: {
						status: 'error',
						message: `Unreachable (${ms}ms)`,
					},
				}));
			});
	};

	const switchHasBindings = (node: any) => {
		if (!node) return false;
		return [0, 1, 2, 3].some((idx) => getUnitBindingsForIdx(node, idx).length > 0);
	};

	const quadrantMatchesSearch = (node: any, idx: number, q: string) => {
		if (!q) return false;
		const term = q.toLowerCase();
		const unit = getQuadrantUnit(node, idx);
		if (unit?.name?.toLowerCase().includes(term)) return true;

		const unitBindings = getUnitBindingsForIdx(node, idx);
		return unitBindings.some((b) => {
			const bindingName = (b.BindingStrName || '').toLowerCase();
			if (bindingName.includes(term)) return true;
			const outputs = getOutputsForBinding(b);
			return outputs.some((o) => o.toLowerCase().includes(term));
		});
	};

	const configuredCount = useMemo(
		() => switchEntries.filter((entry) => switchHasBindings(entry.node)).length,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[switchEntries, bindingsData]
	);

	const filteredSwitches = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		return switchEntries.filter((entry) => {
			if (onlyConfigured && !switchHasBindings(entry.node)) return false;
			if (!q) return true;

			if (entry.name?.toLowerCase().includes(q)) return true;
			if (entry.physicalAddress?.toLowerCase().includes(q)) return true;
			if ([0, 1, 2, 3].some((idx) => quadrantMatchesSearch(entry.node, idx, q))) return true;

			return false;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [switchEntries, onlyConfigured, searchQuery, bindingsData]);

	const dimVirtualsList = useMemo(() => {
		const map = new Map<string, { address: string; name: string; onPct: number; offPct: number; switchCount: number }>();
		for (const entry of switchEntries) {
			const g = getSwitchGeneralLedConfig(entry.node);
			if (g?.virtualAddress) {
				const existing = map.get(g.virtualAddress);
				if (existing) {
					existing.switchCount++;
				} else {
					map.set(g.virtualAddress, {
						address: g.virtualAddress,
						name: g.virtualName || g.virtualAddress,
						onPct: g.levelNight * 10,
						offPct: g.levelDay * 10,
						switchCount: 1,
					});
				}
			}
		}
		return Array.from(map.values());
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [switchEntries, ledsByNode, unitByAddress]);

	const toggleDimVirtual = (virtualAddress: string, e?: React.MouseEvent) => {
		e?.stopPropagation();
		setDimVirtualStates((prev) => ({
			...prev,
			[virtualAddress]: !prev[virtualAddress],
		}));
		const matchedTrig = httpTriggers.find((t) => t.fullAddress === virtualAddress);
		if (matchedTrig) {
			fireHttpTrigger(matchedTrig, e);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center p-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--accent)" />
			</div>
		);
	}

	const qTrim = searchQuery.trim();

	return (
		<div className="space-y-4 max-w-7xl mx-auto w-full">
			{/* Top Bar: Legend + Search + Configured Filter */}
			<div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-2 print:hidden">
				<div className="flex items-center gap-3 text-sm flex-wrap">
					<div className="flex items-center gap-2 border border-(--border)/20 rounded-full px-3 py-1 text-xs font-medium">
						<Hand className="text-pink-500" size={14} /> Pulse
					</div>
					<div className="flex items-center gap-2 border border-(--border)/20 rounded-full px-3 py-1 text-xs font-medium">
						<Sun className="text-pink-500" size={14} /> Long Hold
					</div>
					<span className="text-xs text-[var(--text-muted)]">
						Showing <strong>{filteredSwitches.length}</strong> of {switchEntries.length} switches
					</span>
					{dimVirtualsList.map((dv) => {
						const isTrue = Boolean(dimVirtualStates[dv.address]);
						const activePct = isTrue ? dv.onPct : dv.offPct;
						return (
							<button
								key={dv.address}
								type="button"
								onClick={(e) => toggleDimVirtual(dv.address, e)}
								title={`Click to toggle virtual ${dv.name} (${dv.address}) between TRUE (ON: ${dv.onPct}%) and FALSE (OFF: ${dv.offPct}%)`}
								className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border transition-all cursor-pointer select-none ${
									isTrue
										? 'bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--text)] shadow-sm'
										: 'bg-[var(--background)] border-[var(--border)]/20 text-[var(--text-muted)] hover:text-[var(--text)]'
								}`}
							>
								<Sun size={13} className={isTrue ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
								<span>
									Dim Virtual: <strong className="text-[var(--text)]">{dv.name}</strong>
								</span>
								<span
									className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
										isTrue ? 'bg-[var(--accent)] text-white' : 'bg-[var(--foreground)] text-[var(--text-muted)]'
									}`}
								>
									{isTrue ? `TRUE (${activePct}%)` : `FALSE (${activePct}%)`}
								</span>
							</button>
						);
					})}
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<div className="relative flex-1 sm:w-72">
						<Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search switch, address, or output light..."
							className="w-full h-9 pl-9 pr-8 rounded-xl border border-[var(--border)]/15 bg-[var(--background)] text-xs focus:outline-none focus:border-[var(--accent)]"
						/>
						{searchQuery && (
							<button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]">
								<X size={14} />
							</button>
						)}
					</div>

					<div className="flex items-center gap-1 p-1 bg-[var(--foreground)] rounded-xl border border-[var(--border)]/15">
						<button
							type="button"
							onClick={() => setOnlyConfigured(false)}
							className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
								!onlyConfigured ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
							}`}
						>
							All ({switchEntries.length})
						</button>
						<button
							type="button"
							onClick={() => setOnlyConfigured(true)}
							className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
								onlyConfigured ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
							}`}
						>
							<Filter size={11} />
							Configured ({configuredCount})
						</button>
					</div>
				</div>
			</div>

			{filteredSwitches.length === 0 ? (
				<Card className="p-12 text-center text-[var(--text-muted)] border-dashed">
					<p className="font-medium text-[var(--text)]">No matching switches found</p>
					<p className="text-xs mt-1">Try another search term or switch back to All switches.</p>
				</Card>
			) : (
				<div id="controls-grid" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 print:grid print:grid-cols-4 print:gap-3">
					{filteredSwitches.map((entry) => {
						const { node } = entry;
						const generalLed = getSwitchGeneralLedConfig(node);
						const generalBacklightColor = generalLed?.color ? DUOTECNO_LED_COLORS[generalLed.color] : undefined;
						const isVirtualTrue = generalLed?.virtualAddress ? Boolean(dimVirtualStates[generalLed.virtualAddress]) : false;
						const effectiveDimLevel = generalLed ? (generalLed.virtualAddress ? (isVirtualTrue ? generalLed.levelNight : generalLed.levelDay) : generalLed.level) : 10;
						const effectiveDimPct = Math.max(0, Math.min(100, effectiveDimLevel * 10));
						const dimRatio = effectiveDimPct / 100;

						const renderQuadrant = (idx: number) => {
							const unit = getQuadrantUnit(node, idx);
							const addrKey = node && unit ? `${node.nodeAddress};${unit.unitAddress}` : '';
							const unitBindings = getUnitBindingsForIdx(node, idx);
							const isHighlighted = qTrim.length > 0 && quadrantMatchesSearch(node, idx, qTrim);

							const quadrantTriggers = Array.from(
								new Map(unitBindings.flatMap((b) => getHttpTriggersForBinding(b)).map((t) => [`${t.gatewayIp}:${t.httpPort}/${t.triggerId}`, t])).values()
							);
							const primaryTrigger = quadrantTriggers[0];

							const quadrantKey = addrKey || `${entry.key}-${idx}`;
							const isActive = Boolean(activeQuadrants[quadrantKey]);
							const ledFeedback = getQuadrantLedFeedback(node, idx, unitBindings);
							const onColor = DUOTECNO_LED_COLORS[ledFeedback.colorOn];
							const offColor = DUOTECNO_LED_COLORS[ledFeedback.colorOff] || generalBacklightColor;
							const displayLedColor = isActive ? onColor : offColor || onColor;
							const hasLedConfig = unitBindings.length > 0 || ledFeedback.func > 0;
							const isLedShining = hasLedConfig && Boolean(displayLedColor) && dimRatio > 0;

							return (
								<div
									onClick={(e) => {
										if (primaryTrigger) {
											setActiveQuadrants((prev) => ({ ...prev, [quadrantKey]: !prev[quadrantKey] }));
											fireHttpTrigger(primaryTrigger, e);
										} else if (node) {
											setFocusedChannel(idx);
											setBindingsModal(node);
										}
									}}
									title={
										primaryTrigger
											? `${unit?.name || ''} — Click to trigger ${primaryTrigger.triggerName} (http://${primaryTrigger.gatewayIp}:${primaryTrigger.httpPort}/trigger/${primaryTrigger.triggerId}) • LED ON: ${onColor?.name || 'Off'}${offColor ? ` / OFF: ${offColor.name}` : ''} • Brightness: ${effectiveDimPct}%`
											: unit
												? `${unit.name} — Click to inspect bindings • LED ON: ${onColor?.name || 'Off'}${offColor ? ` / OFF: ${offColor.name}` : ''} • Brightness: ${effectiveDimPct}%`
												: undefined
									}
									style={
										isActive && onColor && dimRatio > 0
											? {
													backgroundColor: onColor.bg,
													boxShadow: `inset 0 0 0 1.5px ${onColor.border}, 0 0 ${Math.round(14 * dimRatio)}px ${onColor.hex}`,
												}
											: isLedShining && displayLedColor
												? {
														boxShadow: `inset 0 ${Math.round(10 * dimRatio)}px ${Math.round(18 * dimRatio)}px -12px ${displayLedColor.hex}`,
													}
												: undefined
									}
									className={`relative flex flex-col items-center justify-center z-10 w-full h-full overflow-hidden transition-all select-none ${
										primaryTrigger ? 'cursor-pointer hover:bg-[var(--accent)]/8 active:scale-[0.99]' : node ? 'cursor-pointer hover:bg-[var(--accent)]/5' : ''
									} ${isHighlighted ? 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent)]/10 print:ring-0 print:bg-transparent' : ''}`}
								>
									{hasLedConfig && displayLedColor && (
										<span
											className="absolute top-1.5 left-1/2 -translate-x-1/2 w-6 h-1.5 rounded-full transition-all duration-200 border border-black/20"
											style={
												dimRatio > 0
													? {
															backgroundColor: displayLedColor.hex,
															boxShadow: `0 0 ${Math.round(4 + 12 * dimRatio)}px ${displayLedColor.hex}, 0 0 ${Math.round(2 + 4 * dimRatio)}px ${displayLedColor.hex}`,
															opacity: Math.max(0.22, dimRatio),
														}
													: {
															backgroundColor: 'rgba(113, 113, 122, 0.25)',
															boxShadow: 'none',
															opacity: 0.3,
														}
											}
										/>
									)}

									{unitBindings.length > 0 ? (
										<div className="flex flex-col gap-1 items-center justify-center w-full px-1.5 pt-3">
											{unitBindings.map((b, i) => {
												const inputEvent = b.inputs.find((input: any) => input.Address?.startsWith(addrKey))?.Event;
												let Icon = Zap;
												if (inputEvent === '0x01')
													Icon = SunDim; // Long Event
												else if (inputEvent === '0x03' || inputEvent === '0x02') Icon = Pointer; // Short Pulse

												const bindingName = (b.BindingStrName || '').replace(/['"]/g, '');
												const outputs = getOutputsForBinding(b);

												return (
													<div key={i} className="flex flex-col items-center w-full justify-center gap-0.5 min-w-0" title={`Binding: ${bindingName} (Event: ${inputEvent})`}>
														<div className="flex flex-row items-center w-full justify-center gap-1 min-w-0">
															<Icon size={13} className="shrink-0 text-(--accent)" />
															<div className="flex flex-col items-start justify-center min-w-0">
																{outputs.map((outName, oIdx) => (
																	<span
																		key={oIdx}
																		className="text-xs print:text-[10px] font-medium leading-tight truncate max-w-full text-left print:whitespace-normal print:overflow-visible print:!text-black"
																	>
																		{outName}
																	</span>
																))}
															</div>
														</div>
													</div>
												);
											})}
										</div>
									) : null}
								</div>
							);
						};

						return (
							<Card key={entry.key} className="p-1.5 flex flex-col h-full print:shadow-none print:border print:border-gray-300 print:w-full print:break-inside-avoid">
								<div className="flex flex-col gap-1.5 mb-2 px-2 pt-2 shrink-0 print-force-black">
									<div className="flex justify-between items-start gap-2">
										<div className="min-w-0">
											<h2
												className="text-lg print:text-sm font-semibold leading-tight truncate print:text-black print-force-black"
												style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}
											>
												{entry.name}
											</h2>
											<p
												className="text-xs print:text-[10px] text-[var(--text-muted)] print:text-black print-force-black"
												style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}
											>
												{entry.physicalAddress}
												{node?.nodeAddress ? ` • Node ${node.nodeAddress}` : ''}
											</p>
										</div>
										{node && (
											<Button
												size="sm"
												variant="ghost"
												icon={<Info size={14} />}
												onClick={() => {
													setFocusedChannel(null);
													setBindingsModal(node);
												}}
												className="print:hidden shrink-0"
											/>
										)}
									</div>

									{generalLed && (
										<div
											onClick={generalLed.virtualAddress ? (e) => toggleDimVirtual(generalLed.virtualAddress!, e) : undefined}
											title={
												generalLed.virtualAddress
													? `Click to toggle virtual "${generalLed.virtualName || generalLed.virtualAddress}" between TRUE (${generalLed.levelNight * 10}%) and FALSE (${generalLed.levelDay * 10}%)`
													: undefined
											}
											className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-1 rounded-lg bg-[var(--background)] print:bg-gray-100 border border-[var(--border)]/15 print:border-gray-300 text-[11px] print:text-[9px] leading-tight transition-colors ${
												generalLed.virtualAddress ? 'cursor-pointer hover:border-[var(--accent)]/40 select-none' : ''
											}`}
										>
											{generalLed.virtualAddress ? (
												<>
													<span className="font-medium text-[var(--text)] print:!text-black truncate">
														Dim Virtual: <strong>{generalLed.virtualName || generalLed.virtualAddress}</strong>{' '}
														<span className="font-mono opacity-70">({generalLed.virtualAddress})</span>
													</span>
													<div className="flex items-center gap-1.5 shrink-0">
														<span className="font-mono font-semibold text-[var(--accent)] print:!text-black">
															ON: {generalLed.levelNight * 10}% · OFF: {generalLed.levelDay * 10}%
														</span>
														<span
															className={`print:hidden px-1.5 py-0.5 rounded font-mono text-[10px] font-bold transition-colors ${
																isVirtualTrue ? 'bg-[var(--accent)] text-white' : 'bg-[var(--foreground)] text-[var(--text-muted)] border border-[var(--border)]/20'
															}`}
														>
															{isVirtualTrue ? `TRUE (${effectiveDimPct}%)` : `FALSE (${effectiveDimPct}%)`}
														</span>
													</div>
												</>
											) : (
												<>
													<span className="text-[var(--text-muted)] print:!text-black">LED-CONFIG: No dim virtual</span>
													<span className="font-mono text-[var(--text-muted)] print:!text-black">
														Level: {generalLed.level * 10}%{generalBacklightColor ? ` (${generalBacklightColor.name})` : ''}
													</span>
												</>
											)}
										</div>
									)}
								</div>

								<div className="relative w-full aspect-square print:aspect-auto print:h-0 print:pb-[100%] bg-[var(--background)] print:bg-transparent rounded-xl border border-[var(--border)]/10 print:border-gray-200 overflow-hidden">
									<ReactSVG
										src="/modules/DTBS-4x/drawing.svg"
										beforeInjection={(svg) => {
											svg.setAttribute('viewBox', '79 -61.5 680 680');
										}}
										className="absolute inset-0 w-full h-full [&>div]:w-full [&>div]:h-full [&_svg]:w-full [&_svg]:h-full opacity-20 print:opacity-40 pointer-events-none"
									/>
									<div className="absolute inset-[9%] grid grid-cols-2 grid-rows-2 gap-[0.5%]">
										{renderQuadrant(0)}
										{renderQuadrant(2)}
										{renderQuadrant(1)}
										{renderQuadrant(3)}
									</div>
								</div>
							</Card>
						);
					})}
				</div>
			)}

			<Modal
				size="xl"
				open={bindingsModal !== null}
				onClose={() => {
					setBindingsModal(null);
					setFocusedChannel(null);
				}}
				title={`${bindingsModal?.name} Input Bindings`}
			>
				<div className="max-h-[70vh] overflow-y-auto p-2 space-y-4">
					{bindingsModal &&
						(() => {
							const generalLed = getSwitchGeneralLedConfig(bindingsModal);
							if (!generalLed) return null;
							const baseColorMeta = DUOTECNO_LED_COLORS[generalLed.color];
							const isVirtualTrue = generalLed.virtualAddress ? Boolean(dimVirtualStates[generalLed.virtualAddress]) : false;
							const activePct = generalLed.virtualAddress ? (isVirtualTrue ? generalLed.levelNight : generalLed.levelDay) * 10 : generalLed.level * 10;
							return (
								<Card className="p-3.5 bg-[var(--background)] border border-[var(--border)]/15">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex items-center gap-2 text-xs">
											<Sun size={15} className="text-[var(--accent)] shrink-0" />
											<span className="font-semibold text-[var(--text)]">LED-CONFIG</span>
											<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--foreground)] border border-[var(--border)]/10 text-[11px]">
												<span
													className="w-2 h-2 rounded-full"
													style={{
														backgroundColor: baseColorMeta ? baseColorMeta.hex : 'transparent',
														border: baseColorMeta ? undefined : '1px solid currentColor',
													}}
												/>
												Backlight: {baseColorMeta ? baseColorMeta.name : 'Off'}
											</span>
										</div>
										{generalLed.virtualAddress ? (
											<div className="flex flex-wrap items-center gap-2 text-xs">
												<span className="text-[var(--text-muted)]">
													Dim Virtual: <strong className="text-[var(--text)]">{generalLed.virtualName || generalLed.virtualAddress}</strong>{' '}
													<code className="opacity-70">({generalLed.virtualAddress})</code>
												</span>
												<span className="px-2 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] font-mono font-semibold">
													ON: {generalLed.levelNight * 10}% · OFF: {generalLed.levelDay * 10}%
												</span>
												<button
													type="button"
													onClick={(e) => toggleDimVirtual(generalLed.virtualAddress!, e)}
													className={`px-2 py-0.5 rounded-md font-mono font-bold transition-colors cursor-pointer ${
														isVirtualTrue
															? 'bg-[var(--accent)] text-white'
															: 'bg-[var(--foreground)] text-[var(--text-muted)] border border-[var(--border)]/20 hover:text-[var(--text)]'
													}`}
												>
													{isVirtualTrue ? `TRUE (${activePct}%)` : `FALSE (${activePct}%)`}
												</button>
											</div>
										) : (
											<div className="text-xs text-[var(--text-muted)]">
												No virtual dim control · Static brightness: <strong className="font-mono text-[var(--text)]">{generalLed.level * 10}%</strong>
											</div>
										)}
									</div>
								</Card>
							);
						})()}
					{focusedChannel !== null && (
						<div className="mb-3 flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-xs">
							<span className="font-medium text-[var(--accent)]">
								Viewing Button Quadrant #{focusedChannel + 1} ({getQuadrantUnit(bindingsModal, focusedChannel)?.name || `Ch ${focusedChannel}`})
							</span>
							<button type="button" onClick={() => setFocusedChannel(null)} className="font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
								Show All Channels
							</button>
						</div>
					)}
					<div className="flex flex-col gap-4">
						{bindingsModal?.units.map((unit: any, index: number) => {
							const focusedUnit = focusedChannel !== null ? getQuadrantUnit(bindingsModal, focusedChannel) : null;
							if (focusedUnit && unit.unitAddress !== focusedUnit.unitAddress) return null;

							const addrKey = `${bindingsModal.nodeAddress};${unit.unitAddress}`;
							const unitBindings = bindingsData.filter((b) => b.inputs.some((i: any) => i.Address?.startsWith(addrKey)));

							if (unitBindings.length === 0 && focusedChannel === null) return null;

							const chNum = parseInt(String(unit.unitAddress || '').replace(/^0x/i, ''), 16);
							const chLed = !Number.isNaN(chNum) && chNum >= 0 && chNum <= 3 ? getQuadrantLedFeedback(bindingsModal, chNum, unitBindings) : null;
							const chOnMeta = chLed ? DUOTECNO_LED_COLORS[chLed.colorOn] : undefined;
							const chOffMeta = chLed ? DUOTECNO_LED_COLORS[chLed.colorOff] : undefined;

							return (
								<Card key={index} className="p-4">
									<div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3">
										<h4 className="font-semibold text-lg">
											{unit.name} <span className="opacity-50 font-normal text-sm ml-2">(Ch {unit.unitAddress})</span>
										</h4>
										{chLed && (
											<div className="flex items-center gap-2 text-xs text-[var(--text-muted)] bg-[var(--foreground)] px-2.5 py-1 rounded-lg border border-[var(--border)]/10">
												<span className="inline-flex items-center gap-1">
													<span
														className="w-2 h-2 rounded-full"
														style={{
															backgroundColor: chOnMeta ? chOnMeta.hex : 'transparent',
															border: chOnMeta ? undefined : '1px solid currentColor',
														}}
													/>
													ON: <strong className="text-[var(--text)]">{chOnMeta ? chOnMeta.name : 'Off'}</strong>
												</span>
												<span>/</span>
												<span className="inline-flex items-center gap-1">
													<span
														className="w-2 h-2 rounded-full"
														style={{
															backgroundColor: chOffMeta ? chOffMeta.hex : 'transparent',
															border: chOffMeta ? undefined : '1px solid currentColor',
														}}
													/>
													OFF: <strong className="text-[var(--text)]">{chOffMeta ? chOffMeta.name : 'Off'}</strong>
												</span>
												{chLed.targetName && <span className="opacity-75">· Tracks: {chLed.targetName}</span>}
											</div>
										)}
									</div>

									{unitBindings.length === 0 ? (
										<p className="text-xs text-[var(--text-muted)] italic">No bindings configured on this button channel.</p>
									) : (
										<div className="space-y-4">
											{unitBindings.map((b: any, bIdx: number) => {
												const inputEvent = b.inputs.find((i: any) => i.Address?.startsWith(addrKey))?.Event;
												let eventLabel = 'Unknown Event';
												if (inputEvent === '0x01') eventLabel = 'Long Event';
												else if (inputEvent === '0x03' || inputEvent === '0x02') eventLabel = 'Short Pulse';
												else if (inputEvent) eventLabel = `Event: ${inputEvent}`;

												const matchedTriggers = getHttpTriggersForBinding(b);

												return (
													<div key={bIdx} className="bg-[var(--foreground)] rounded-md p-3 space-y-3">
														<div className="flex items-center justify-between">
															<span className="font-medium text-sm text-[var(--accent)]">{eventLabel}</span>
															<span className="text-xs opacity-50">{b.BindingStrName}</span>
														</div>

														<div className="text-sm space-y-1">
															<div className="font-medium mb-1">Triggers Outputs:</div>
															{b.outputs.length === 0 && <span className="opacity-50 italic">None</span>}
															{b.outputs.map((out: any, oIdx: number) => {
																let outName = out.unitInfo || '';
																if (outName.includes('Unit: ')) outName = outName.split('Unit: ')[1];
																return (
																	<div key={oIdx} className="flex items-center gap-2 text-[var(--text-muted)]">
																		<div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/50" />
																		<span>{outName.replace(/^,/, '').trim()}</span>
																	</div>
																);
															})}
														</div>

														{matchedTriggers.length > 0 && (
															<div className="pt-2 border-t border-[var(--border)]/10 space-y-2">
																{matchedTriggers.map((trig) => {
																	const key = `${trig.gatewayIp}:${trig.httpPort}/${trig.triggerId}`;
																	const resp = triggerStatus[key];
																	return (
																		<div key={key} className="flex flex-col gap-2">
																			<div className="flex items-center justify-between gap-2 text-xs">
																				<span className="font-semibold text-[var(--text)]">{trig.triggerName}</span>
																				<span className="text-[var(--text-muted)] font-mono">{trig.fullAddress}</span>
																			</div>
																			<div className="flex items-center gap-2">
																				<div className="flex-1 min-w-0 flex items-center bg-[var(--background)] border border-[var(--border)]/15 rounded-xl px-3 h-10 font-mono text-xs sm:text-sm">
																					<span className="text-[var(--text-muted)] truncate select-all">
																						http://{trig.gatewayIp}:{trig.httpPort}/trigger/
																					</span>
																				</div>
																				<div className="w-16 h-10 shrink-0 flex items-center justify-center rounded-xl bg-[var(--background)] border border-[var(--border)]/15 font-mono text-sm text-[var(--accent)] font-bold select-all">
																					{trig.triggerId}
																				</div>
																				<Button
																					variant="primary"
																					size="sm"
																					className="!h-10 shrink-0"
																					onClick={(e) => fireHttpTrigger(trig, e)}
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
																							? 'bg-[var(--background)] border-[var(--border)]/15 text-[var(--text-muted)]'
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
															</div>
														)}
													</div>
												);
											})}
										</div>
									)}
								</Card>
							);
						})}
					</div>
				</div>
			</Modal>
		</div>
	);
}
