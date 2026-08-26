/** @format */
'use client';

import {
	BookIcon,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	ChevronsUpDown,
	CircuitBoard,
	Lightbulb,
	ListTree,
	Minus,
	Music,
	Pencil,
	Plus,
	Power,
	Save,
	Settings,
	Activity,
	Thermometer,
	ToggleLeft,
	Trash2,
	Printer,
	Loader2,
	FileWarning,
	Cable,
} from 'lucide-react';
import { linkNodeUnitsWithBindings } from '@/lib/duotecno';
import { useEffect, useState, useMemo } from 'react';

import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Loading from '../ui/Loading';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import { ReactSVG } from 'react-svg';
import { usePermissions } from '@/providers/PermissionsProvider';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const units = {
	Sens: <Thermometer size={30} />, // or FaTemperatureHigh
	Virtual: <CircuitBoard size={30} />,
	Control: <ToggleLeft size={30} />,
	Motor: <ChevronsUpDown size={30} />,
	Dimmer: <Lightbulb size={30} />,
	Relais: <Power size={30} />,
	Audio: <Music size={30} />,
};

type Props = {
	client: string;
	basePath: string;
};

export type ModuleDefinition = {
	id: string;
	name: string;
	description?: string;
	category?: string;
	detectable: boolean;
	channels?: number;
	units?: any[];
};

export type Metadata = {
	setup?: TopologyModule[][];
	sim?: TopologyModule[][];
};

export type DetectedNode = {
	name: string;
	nodeAddress: string;
	physicalAddress: string;
	softwareVersion: string;
	numberOfUnits: number;
	nodeType: number;
	units: any[];
};

export type TopologyModule = {
	instanceId: string;
	moduleId: string;
	physicalAddress?: string;
	customName?: string;
	nodes?: Record<number, TopologyModule[]>;
};

type ModuleSelection =
	| {
			mode: 'add';
			node: DetectedNode;
	  }
	| {
			mode: 'edit';
			topology: TopologyModule;
	  };

export default function Canbus({ basePath, client }: Props) {
	const { has } = usePermissions();

	const [dockNode, setDockNode] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setDockNode(document.getElementById('project-dock-actions'));
	}, []);

	const [loading, setLoading] = useState(true);

	const [metadata, setMetadata] = useState<Metadata | null>(null);
	const [noProgrammation, setNoProgrammation] = useState(false);

	const [availableModules, setAvailableModules] = useState<ModuleDefinition[]>([]);

	const [foundModules, setFoundModules] = useState<DetectedNode[]>([]);
	const [topology, setTopology] = useState<TopologyModule[][]>([]);
	const [viewMode, setViewMode] = useState<'setup' | 'sim'>('setup');

	const [search, setSearch] = useState('');
	const [searchIndex, setSearchIndex] = useState(0);

	const matches = useMemo(() => {
		if (!search) return [];
		const term = search.toLowerCase();
		const results: string[] = [];

		function traverse(tree: TopologyModule[]) {
			for (const entry of tree) {
				const module = availableModules.find((m) => m.id === entry.moduleId);
				const node = foundModules.find((n) => n.physicalAddress === entry.physicalAddress);

				let isMatch = false;

				if (module && (module.name.toLowerCase().includes(term) || module.id.toLowerCase().includes(term))) {
					isMatch = true;
				}

				if (node) {
					if (node.name.toLowerCase().includes(term)) isMatch = true;
					if (node.physicalAddress.toLowerCase().includes(term)) isMatch = true;
					if (node.nodeAddress?.toString().toLowerCase().includes(term)) isMatch = true;
					if (node.units?.some((u: any) => u.name?.toLowerCase().includes(term) || u.unitTypeName?.toLowerCase().includes(term))) {
						isMatch = true;
					}
				}

				if (isMatch) results.push(entry.instanceId);

				for (const children of Object.values(entry.nodes ?? {})) {
					if (children) traverse(children);
				}
			}
		}

		topology.forEach((t) => traverse(t));
		return results;
	}, [search, topology, availableModules, foundModules]);

	useEffect(() => {
		setSearchIndex(0);
	}, [search]);

	const activeMatchId = matches[searchIndex];

	useEffect(() => {
		if (activeMatchId) {
			const el = document.getElementById('module-' + activeMatchId);
			if (el) {
				el.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
					inline: 'center',
				});
			}
		}
	}, [activeMatchId]);

	const [addModalOpen, setAddModalOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [unitModal, setUnitModal] = useState<DetectedNode | null>(null);
	const [bindingsModal, setBindingsModal] = useState<DetectedNode | null>(null);
	const [bindingsData, setBindingsData] = useState<any[]>([]);
	const [printing, setPrinting] = useState(false);

	const [simulatedModuleNaming, setSimulatedModuleNaming] = useState<ModuleDefinition | null>(null);
	const [simulatedModuleName, setSimulatedModuleName] = useState('');

	const [moduleSelection, setModuleSelection] = useState<ModuleSelection | null>(null);

	const [insertTarget, setInsertTarget] = useState<{
		type: 'branch_start' | 'after_node' | 'root_start' | 'end';
		lineIndex?: number;
		parentId?: string;
		branch?: number;
		targetId?: string;
	} | null>(null);

	const [zoom, setZoom] = useState(1);

	const unplacedModules = viewMode === 'sim' ? [] : foundModules.filter((node) => !containsPhysicalAddress(topology.flat(), node.physicalAddress));

	const detectableModules = availableModules.filter((m) => m.detectable);

	const manualModules = availableModules.filter((m) => !m.detectable);

	const [moduleSearch, setModuleSearch] = useState('');

	const filterModule = (m: ModuleDefinition) => {
		if (!moduleSearch) return true;
		const s = moduleSearch.toLowerCase();
		return m.name.toLowerCase().includes(s) || m.category?.toLowerCase().includes(s) || m.id.toLowerCase().includes(s);
	};

	const groupedDetectableModules = useMemo(() => {
		const groups: Record<string, ModuleDefinition[]> = {};
		detectableModules.filter(filterModule).forEach((m) => {
			const cat = m.category || 'Other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(m);
		});
		return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
	}, [detectableModules, moduleSearch]);

	const groupedManualModules = useMemo(() => {
		const groups: Record<string, ModuleDefinition[]> = {};
		manualModules.filter(filterModule).forEach((m) => {
			const cat = m.category || 'Other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(m);
		});
		return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
	}, [manualModules, moduleSearch]);

	const groupedAvailableModules = useMemo(() => {
		const groups: Record<string, ModuleDefinition[]> = {};
		availableModules.filter(filterModule).forEach((m) => {
			const cat = m.category || 'Other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(m);
		});
		return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
	}, [availableModules, moduleSearch]);

	function findNextSwitch(tree: TopologyModule[], instanceId: string): TopologyModule | null {
		for (let i = 0; i < tree.length; i++) {
			if (tree[i].instanceId === instanceId) {
				for (let j = i + 1; j < tree.length; j++) {
					const def = availableModules.find((m) => m.id === tree[j].moduleId);

					if ((def?.channels ?? 0) > 0) {
						return tree[j];
					}
				}

				return null;
			}
		}

		return null;
	}

	function containsPhysicalAddress(tree: TopologyModule[], address: string): boolean {
		for (const module of tree) {
			if (module.physicalAddress === address) return true;

			for (const branch of Object.values(module.nodes ?? {})) {
				if (containsPhysicalAddress(branch, address)) {
					return true;
				}
			}
		}

		return false;
	}

	function insertIntoBranch(tree: TopologyModule[], parentId: string, branch: number, module: TopologyModule): boolean {
		for (const node of tree) {
			if (node.instanceId === parentId) {
				node.nodes ??= {};

				node.nodes[branch] ??= [];

				node.nodes[branch]!.unshift(module);

				return true;
			}

			for (const children of Object.values(node.nodes ?? {})) {
				if (insertIntoBranch(children, parentId, branch, module)) {
					return true;
				}
			}
		}

		return false;
	}

	function insertAfter(tree: TopologyModule[], targetId: string, module: TopologyModule): boolean {
		for (let i = 0; i < tree.length; i++) {
			if (tree[i].instanceId === targetId) {
				tree.splice(i + 1, 0, module);
				return true;
			}
			for (const children of Object.values(tree[i].nodes ?? {})) {
				if (insertAfter(children, targetId, module)) {
					return true;
				}
			}
		}
		return false;
	}

	async function executeInsertion(module: TopologyModule) {
		const next = structuredClone(topology);
		if (!insertTarget || insertTarget.type === 'end') {
			const lineIndex = insertTarget?.lineIndex ?? next.length;
			if (!next[lineIndex]) next[lineIndex] = [];
			next[lineIndex].push(module);
			await saveTopology(next);
		} else if (insertTarget.type === 'root_start') {
			const lineIndex = insertTarget?.lineIndex ?? 0;
			if (!next[lineIndex]) next[lineIndex] = [];
			next[lineIndex].unshift(module);
			await saveTopology(next);
		} else if (insertTarget.type === 'branch_start' && insertTarget.parentId && insertTarget.branch) {
			for (const line of next) {
				if (insertIntoBranch(line, insertTarget.parentId, insertTarget.branch, module)) break;
			}
			await saveTopology(next);
		} else if (insertTarget.type === 'after_node' && insertTarget.targetId) {
			for (const line of next) {
				if (insertAfter(line, insertTarget.targetId, module)) break;
			}
			await saveTopology(next);
		}

		setInsertTarget(null);
		setAddModalOpen(false);
	}

	function addManualModule(definition: ModuleDefinition) {
		if (viewMode === 'sim' && definition.detectable) {
			setSimulatedModuleNaming(definition);
			setSimulatedModuleName(definition.name);
			return;
		}

		const manual: TopologyModule = {
			instanceId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
			moduleId: definition.id,
			physicalAddress: undefined,
		};
		executeInsertion(manual);
		setAddModalOpen(false);
	}

	function confirmSimulatedModule() {
		if (!simulatedModuleNaming) return;
		const definition = simulatedModuleNaming;
		const customName = simulatedModuleName;

		const simulatedAddress =
			'0x' +
			Math.floor(Math.random() * 16777215)
				.toString(16)
				.padStart(6, '0');

		const fakeNode: DetectedNode = {
			name: customName || definition.name,
			physicalAddress: simulatedAddress,
			nodeAddress: Math.floor(Math.random() * 255).toString(),
			softwareVersion: '1.0.0',
			numberOfUnits: definition.channels ? Math.ceil(definition.channels / 4) : 0,
			nodeType: 0,
			units: [],
		};
		setFoundModules((prev) => [...prev, fakeNode]);

		const manual: TopologyModule = {
			instanceId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
			moduleId: definition.id,
			physicalAddress: simulatedAddress,
			customName: customName || definition.name,
		};
		executeInsertion(manual);

		setSimulatedModuleNaming(null);
		setAddModalOpen(false);
	}

	function selectDetectedModule(node: DetectedNode) {
		setAddModalOpen(false);

		setModuleSelection({
			mode: 'add',
			node,
		});
	}

	async function addDetectedModule(module: ModuleDefinition) {
		if (!moduleSelection || moduleSelection.mode !== 'add') {
			return;
		}

		const detected: TopologyModule = {
			instanceId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
			moduleId: module.id,
			physicalAddress: moduleSelection.node.physicalAddress,
		};

		executeInsertion(detected);
		setModuleSelection(null);
	}

	function removeRecursive(tree: TopologyModule[], id: string): TopologyModule[] {
		return tree
			.filter((module) => module.instanceId !== id)
			.map((module) => ({
				...module,
				nodes: module.nodes ? Object.fromEntries(Object.entries(module.nodes).map(([branch, children]) => [branch, removeRecursive(children, id)])) : undefined,
			}));
	}

	function removeModule(instanceId: string) {
		saveTopology(topology.map((line) => removeRecursive(line, instanceId)));
	}

	function editModule(topology: TopologyModule) {
		setModuleSelection({
			mode: 'edit',
			topology,
		});
	}

	function updateRecursive(tree: TopologyModule[], id: string, moduleId: string): TopologyModule[] {
		return tree.map((module) => ({
			...module,
			moduleId: module.instanceId === id ? moduleId : module.moduleId,

			nodes: module.nodes ? Object.fromEntries(Object.entries(module.nodes).map(([branch, children]) => [branch, updateRecursive(children, id, moduleId)])) : undefined,
		}));
	}

	function moveRecursive(tree: TopologyModule[], instanceId: string, direction: 'up' | 'down'): boolean {
		for (let i = 0; i < tree.length; i++) {
			const module = tree[i];

			// Move within the current list
			if (module.instanceId === instanceId) {
				if (direction === 'up' && i > 0) {
					[tree[i - 1], tree[i]] = [tree[i], tree[i - 1]];
				}

				if (direction === 'down' && i < tree.length - 1) {
					[tree[i + 1], tree[i]] = [tree[i], tree[i + 1]];
				}

				return true;
			}

			// Search every branch
			for (const children of Object.values(module.nodes ?? {})) {
				const index = children.findIndex((x) => x.instanceId === instanceId);

				// First module of a branch -> move before switch
				if (index === 0 && direction === 'up') {
					const moving = children.shift()!;

					tree.splice(i, 0, moving);

					return true;
				}

				if (moveRecursive(children, instanceId, direction)) {
					return true;
				}
			}
		}

		return false;
	}

	async function moveModule(instanceId: string, direction: 'up' | 'down') {
		const next = structuredClone(topology);

		for (const line of next) {
			if (moveRecursive(line, instanceId, direction)) break;
		}

		await saveTopology(next);
	}

	async function changeModuleType(module: ModuleDefinition) {
		if (!moduleSelection || moduleSelection.mode !== 'edit') return;

		const next = topology.map((line) => updateRecursive(line, moduleSelection.topology.instanceId, module.id));

		await saveTopology(next);

		setModuleSelection(null);
	}

	async function saveTopology(next: TopologyModule[][]) {
		setTopology(next);

		try {
			await fetch('/api/projects/canbus', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					client,
					data: {
						[viewMode]: next,
					},
				}),
			});

			setMetadata((current) =>
				current
					? {
							...current,
							[viewMode]: next,
						}
					: current
			);
		} catch (error) {
			console.error(error);
		}
	}

	async function load() {
		try {
			setLoading(true);

			const [metadata, canbusData] = await Promise.all([
				fetch(`/api/projects/metadata?client=${client}`)
					.then((r) => r.json())
					.catch(() => null),
				fetch(`/api/projects/canbus?client=${client}`)
					.then((r) => r.json())
					.catch(() => null),
			]);

			const programmationPath = `${basePath}/${client}/Programmation`;

			const files = await fetch(`/api/files?view=${encodeURIComponent(programmationPath)}&recursive=1`).then((r) => r.json());

			// Find every folder that contains a .duo file
			const projectFolders: Array<string> = Array.from(
				new Set(files.filter((f: any) => f.type === 'file' && f.name.toLowerCase().endsWith('.duo')).map((f: any) => f.path.split(/[\\/]/).slice(0, -1).join('/')))
			);

			// Pick the folder whose name ends with YYYYMMDD
			const latestFolder = projectFolders
				.map((folder: string) => {
					const folderName = folder.split(/[\\/]/).pop() ?? '';
					const [, date] = folderName.split('__');

					return {
						folder,
						date: date ?? '00000000',
					};
				})
				.sort((a, b) => b.date.localeCompare(a.date))[0]?.folder;

			const moduleDefinitions = await fetch('/api/projects/modules').then((r) => r.json());
			setAvailableModules(moduleDefinitions.modules ?? []);

			setMetadata(metadata);

			let loadedSetup = canbusData?.setup ?? metadata?.setup ?? [];
			if (loadedSetup.length > 0 && !Array.isArray(loadedSetup[0])) {
				loadedSetup = [loadedSetup];
			}
			let loadedSim = canbusData?.sim ?? metadata?.sim ?? [];
			if (loadedSim.length > 0 && !Array.isArray(loadedSim[0])) {
				loadedSim = [loadedSim];
			}
			if (metadata) {
				metadata.setup = loadedSetup;
				metadata.sim = loadedSim;
			}

			if (!latestFolder) {
				setFoundModules([]);
				setNoProgrammation(true);
				setViewMode('sim');
				setTopology(loadedSim);
			} else {
				setNoProgrammation(false);
				try {
					const nodeDatabase = await fetch(`/api/files/download?path=${encodeURIComponent(`${latestFolder}/Config/nodedatabase.cache.json`)}`).then((r) => r.json());
					setFoundModules(nodeDatabase.nodes ?? []);

					try {
						const bindingTxt = await fetch(`/api/files/download?path=${encodeURIComponent(`${latestFolder}/Config/bindingconfiginfo.txt`)}`).then((r) => r.text());
						const bindings = linkNodeUnitsWithBindings(JSON.stringify(nodeDatabase), bindingTxt);
						setBindingsData(bindings);
					} catch (err) {
						setBindingsData([]);
					}
				} catch (e) {
					setFoundModules([]);
					setBindingsData([]);
				}
				setTopology(viewMode === 'sim' ? loadedSim : loadedSetup);
			}
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	}

	function beginBranch(parent: TopologyModule, branch: number) {
		setInsertTarget({
			type: 'branch_start',
			parentId: parent.instanceId,
			branch,
		});
		setAddModalOpen(true);
	}

	function beginInsertAfter(target: TopologyModule) {
		setInsertTarget({
			type: 'after_node',
			targetId: target.instanceId,
		});
		setAddModalOpen(true);
	}

	function beginInsertRoot(lineIndex: number) {
		setInsertTarget({ type: 'root_start', lineIndex });
		setAddModalOpen(true);
	}

	function beginInsertEnd(lineIndex: number) {
		setInsertTarget({ type: 'end', lineIndex });
		setAddModalOpen(true);
	}

	function beginInsertNewBusLine() {
		setInsertTarget({ type: 'end', lineIndex: topology.length });
		setAddModalOpen(true);
	}

	function getBranchPosition(tree: TopologyModule[], id: string): { first: boolean; last: boolean } | null {
		for (const module of tree) {
			for (const children of Object.values(module.nodes ?? {})) {
				const index = children.findIndex((x) => x.instanceId === id);

				if (index !== -1) {
					return {
						first: index === 0,
						last: index === children.length - 1,
					};
				}

				const found = getBranchPosition(children, id);

				if (found) return found;
			}
		}

		return null;
	}

	function getLineOfModule(id: string) {
		return topology.findIndex((line) => {
			let found = false;
			function check(t: TopologyModule) {
				if (t.instanceId === id) found = true;
				for (const branch of Object.values(t.nodes ?? {})) {
					branch.forEach(check);
				}
			}
			line.forEach(check);
			return found;
		});
	}

	function isRootModule(id: string) {
		return topology.some((line) => line[0]?.instanceId === id);
	}

	function isLastRootModule(id: string) {
		return topology.some((line) => line[line.length - 1]?.instanceId === id);
	}

	function isBeforeSwitch(tree: TopologyModule[], id: string): boolean {
		for (let i = 0; i < tree.length - 1; i++) {
			if (tree[i].instanceId === id && (tree[i + 1].moduleId === 'DT00-24SW' || tree[i + 1].moduleId === 'DT13-SW')) {
				return true;
			}

			for (const children of Object.values(tree[i].nodes ?? {})) {
				if (isBeforeSwitch(children, id)) {
					return true;
				}
			}
		}

		return false;
	}

	function extractModule(tree: TopologyModule[], instanceId: string): TopologyModule | null {
		for (let i = 0; i < tree.length; i++) {
			if (tree[i].instanceId === instanceId) return tree.splice(i, 1)[0];

			for (const children of Object.values(tree[i].nodes ?? {})) {
				const found = extractModule(children, instanceId);

				if (found) {
					return found;
				}
			}
		}

		return null;
	}

	async function moveModuleToBranch(instanceId: string, direction: -1 | 1) {
		const next = structuredClone(topology);

		const location = getBranchOfModule(next.flat(), instanceId);

		if (!location) {
			// Module is on the main line

			let moving: TopologyModule | null = null;
			let lineIndex = -1;
			for (let i = 0; i < next.length; i++) {
				moving = extractModule(next[i], instanceId);
				if (moving) {
					lineIndex = i;
					break;
				}
			}

			if (!moving || lineIndex === -1) return;

			const targetSwitch = findNextSwitch(next[lineIndex], instanceId);

			if (!targetSwitch) return;

			targetSwitch.nodes ??= {};
			targetSwitch.nodes[1] ??= [];

			targetSwitch.nodes[1].unshift(moving);

			await saveTopology(next);

			return;
		}
	}

	function getBranchOfModule(
		tree: TopologyModule[],
		id: string
	): {
		parentId: string;
		branch: number;
	} | null {
		for (const module of tree) {
			for (const [branch, children] of Object.entries(module.nodes ?? {})) {
				if (children.some((x) => x.instanceId === id)) {
					return {
						parentId: module.instanceId,
						branch: Number(branch),
					};
				}

				const found = getBranchOfModule(children, id);

				if (found) return found;
			}
		}

		return null;
	}

	function findSwitchParent(tree: TopologyModule[], instanceId: string): TopologyModule | null {
		for (const module of tree) {
			for (const children of Object.values(module.nodes ?? {})) {
				if (children.some((x) => x.instanceId === instanceId)) {
					return module;
				}

				const found = findSwitchParent(children, instanceId);

				if (found) return found;
			}
		}

		return null;
	}

	function renderModule(entry: TopologyModule) {
		const currentLineIndex = getLineOfModule(entry.instanceId);
		const currentLine = currentLineIndex !== -1 ? topology[currentLineIndex] : [];

		const position = getBranchPosition(currentLine, entry.instanceId);

		const firstInBranch = position?.first ?? false;
		const lastInBranch = position?.last ?? false;

		const rootModule = isRootModule(entry.instanceId);
		const lastRootModule = isLastRootModule(entry.instanceId);

		const beforeSwitch = isBeforeSwitch(currentLine, entry.instanceId);

		const inBranch = getBranchOfModule(currentLine, entry.instanceId) !== null;

		const canMoveLeft = inBranch || lastRootModule;
		const canMoveRight = rootModule ? !beforeSwitch : !lastInBranch;
		const canMoveUp = inBranch && (firstInBranch || lastInBranch);
		const canMoveDown = inBranch && (firstInBranch || lastInBranch);

		const module = availableModules.find((m) => m.id === entry.moduleId);

		const node = foundModules.find((n) => n.physicalAddress === entry.physicalAddress);

		if (!module) return null;

		const isMatch = activeMatchId === entry.instanceId;

		if (module.id === 'DT-120OHM') {
			return (
				<div
					id={'module-' + entry.instanceId}
					key={entry.instanceId}
					className={`relative w-full flex flex-col items-center justify-start transition-all duration-300 ${editing ? 'min-h-[500px]' : 'min-h-[360px]'} ${isMatch ? 'ring-4 ring-[var(--accent)] shadow-xl scale-105 z-50 rounded-xl' : ''}`}
				>
					{/* Pass-through wire */}
					<div
						className="absolute h-2.5 flex flex-col justify-between"
						style={{
							top: '10rem',
							left: rootModule || firstInBranch ? '50%' : '0',
							right: lastRootModule || lastInBranch ? '50%' : '0',
						}}
					>
						<div className="h-0.75 w-full bg-orange-500" />
						<div className="h-0.75 w-full bg-orange-200" />
					</div>

					{/* The circle */}
					<div
						className="absolute w-16 h-16 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md z-20 print:border-4 print:bg-white print:text-orange-800 print:border-orange-500 group"
						style={{ top: '10rem', transform: 'translateY(-50%)' }}
					>
						<span className="font-bold text-sm">120Ω</span>

						{/* Quick Delete overlay for resistor */}
						{editing && (
							<button
								onClick={() => removeModule(entry.instanceId)}
								className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:scale-110 shadow-sm"
							>
								<Trash2 size={12} />
							</button>
						)}
					</div>
				</div>
			);
		}

		const branchCount = module?.channels ?? 0;

		return (
			<Card
				id={'module-' + entry.instanceId}
				key={entry.instanceId}
				className={`relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${editing ? 'min-h-[500px]' : 'min-h-[360px]'} ${isMatch ? 'ring-4 ring-[var(--accent)] shadow-xl scale-105 z-50' : ''}`}
			>
				<div className="flex flex-col gap-4">
					<div className="rounded-lg p-1 flex items-center justify-center h-[160px] shrink-0">
						<ReactSVG src={`/modules/${module.id}/drawing.svg`} className="w-full h-full [&>svg]:w-full [&>svg]:h-full" />
					</div>

					<div className="px-3 pt-8">
						<h3 className="font-semibold">{module.name}</h3>

						{node ? (
							<>
								<p className="text-sm opacity-70">{node.name}</p>
								<p className="text-sm opacity-70">
									{node.physicalAddress} - {node.nodeAddress} - {node.numberOfUnits}U
								</p>
								<p className="text-sm opacity-70"></p>
							</>
						) : (
							<p className="text-sm opacity-70">{entry.customName || 'Infrastructure module'}</p>
						)}
					</div>

					<div className="px-3 pb-3 space-y-3">
						{/* Actions */}
						<div className="flex flex-wrap justify-end gap-2">
							{!!node?.units?.length && module.detectable && <Button variant="ghost" icon={<ListTree size={14} />} onClick={() => setUnitModal(node)} />}
							{!!node?.units?.length && module.detectable && <Button variant="ghost" icon={<Cable size={14} />} onClick={() => setBindingsModal(node)} />}

							<Button variant="ghost" icon={<BookIcon size={14} />} onClick={() => window.open(`/modules/${module.id}/datasheet.pdf`, '_blank')} />

							{editing && <Button variant="ghost" icon={<Pencil size={14} />} onClick={() => editModule(entry)} />}

							{editing && <Button variant="danger-ghost" icon={<Trash2 size={14} />} onClick={() => removeModule(entry.instanceId)} />}
						</div>

						{/* Movement */}
						{editing && (
							<div className="flex flex-col items-center gap-4">
								{branchCount > 0 && (
									<div className="flex flex-wrap justify-center gap-2">
										{Array.from({ length: branchCount }, (_, i) => (
											<Button key={i} variant="ghost" onClick={() => beginBranch(entry, i + 1)}>
												<Plus size={14} />
												Bus {i + 1}
											</Button>
										))}
									</div>
								)}

								<div className="grid grid-cols-3 gap-1 w-[108px]">
									<div />
									<div className="flex justify-center">
										{canMoveUp && <Button size="sm" variant="ghost" icon={<ChevronUp size={14} />} onClick={() => moveModuleToBranch(entry.instanceId, -1)} />}
									</div>
									<div />
									<div className="flex justify-center">
										{canMoveLeft && <Button size="sm" variant="ghost" icon={<ChevronLeft size={14} />} onClick={() => moveModule(entry.instanceId, 'up')} />}
									</div>
									<div />
									<div className="flex justify-center">
										{canMoveRight && <Button size="sm" variant="ghost" icon={<ChevronRight size={14} />} onClick={() => moveModule(entry.instanceId, 'down')} />}
									</div>
									<div />
									<div className="flex justify-center">
										{canMoveDown && <Button size="sm" variant="ghost" icon={<ChevronDown size={14} />} onClick={() => moveModuleToBranch(entry.instanceId, 1)} />}
									</div>
									<div />
								</div>
							</div>
						)}
					</div>
				</div>
			</Card>
		);
	}

	function renderSerialLine(line: TopologyModule[] | undefined): React.ReactNode {
		if (!line || line.length === 0) return null;

		const entry = line[0];
		const rest = line.slice(1);

		return renderTopologyNode(entry, rest);
	}

	function renderTopologyNode(entry: TopologyModule, serialRest: TopologyModule[]): React.ReactNode {
		const module = availableModules.find((m) => m.id === entry.moduleId);
		const branchCount = module?.channels ?? 0;
		const branches = Array.from({ length: branchCount }, (_, i) => ({
			name: `Bus ${i + 1}`,
			content: renderSerialLine(entry.nodes?.[i + 1]),
			empty: !entry.nodes?.[i + 1] || entry.nodes[i + 1].length === 0,
		})).filter((b) => !b.empty);

		return (
			<div key={entry.instanceId} className="flex flex-row items-start">
				{/* This node and its branches */}
				<div className="flex flex-col items-start relative">
					{/* Module Card */}
					<div className="flex-shrink-0 z-10 w-[280px]">{renderModule(entry)}</div>

					{/* Branches Container */}
					{branches.length > 0 && (
						<div className="flex flex-col relative w-0 items-start mt-4 overflow-visible">
							{branches.map((branch, i) => (
								<div key={i} className="flex flex-row items-start relative pt-8 pb-4 w-max">
									{/* Vertical drop line segment */}
									<div
										className="absolute flex flex-row justify-between w-2.5 -translate-x-1/2"
										style={{
											left: '140px',
											top: i === 0 ? '-1rem' : '0',
											bottom: i === branches.length - 1 ? 'calc(100% - 10rem)' : '0',
										}}
									>
										<div className="w-0.75 h-full bg-orange-500" />
										<div className="w-0.75 h-full bg-orange-200" />
									</div>

									{/* Horizontal branch line */}
									<div className="w-[188px] absolute flex flex-col justify-between h-2.5 group" style={{ left: '140px', top: '10rem' }}>
										<div className="h-0.75 w-full bg-orange-500" />
										<div className="h-0.75 w-full bg-orange-200" />

										<div className="absolute left-1/2 -translate-x-1/2 -top-6 px-3 py-1 bg-(--background) rounded-full border border-(--border)/10 text-xs font-medium opacity-50 z-20 whitespace-nowrap">
											{branch.name}
										</div>

										{editing && (
											<button
												onClick={() => beginBranch(entry, i + 1)}
												className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:scale-110 shadow-sm"
											>
												<Plus size={14} />
											</button>
										)}
									</div>

									{/* Branch content */}
									<div className="flex flex-row items-start relative z-10" style={{ marginLeft: '328px' }}>
										<div className="flex-shrink-0">{branch.content}</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Serial Continuation */}
				{(serialRest.length > 0 || editing) && (
					<>
						<div className={`w-12 relative flex flex-col justify-between h-2.5 flex-shrink-0 group ${serialRest.length === 0 ? 'opacity-50' : ''}`} style={{ marginTop: '10rem' }}>
							<div className="h-0.75 w-full bg-orange-500" />
							<div className="h-0.75 w-full bg-orange-200" />

							{editing && (
								<button
									onClick={() => beginInsertAfter(entry)}
									className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:scale-110 shadow-sm"
								>
									<Plus size={14} />
								</button>
							)}
						</div>
						{serialRest.length > 0 && renderSerialLine(serialRest)}
					</>
				)}
			</div>
		);
	}

	useEffect(() => {
		load();
	}, [client, basePath]);

	useEffect(() => {
		if (metadata) {
			setTopology(viewMode === 'sim' ? (metadata.sim ?? []) : (metadata.setup ?? []));
		}
	}, [viewMode, metadata]);

	useEffect(() => {
		const container = document.getElementById('canbus-topology-container');

		const handleWheel = (e: WheelEvent) => {
			if (e.ctrlKey) {
				e.preventDefault();
				setZoom((z) => {
					// Smooth zoom based on delta
					const newZoom = z - e.deltaY * 0.002;
					return Math.min(5, Math.max(0.05, newZoom));
				});
			}
		};

		if (container) {
			container.addEventListener('wheel', handleWheel, { passive: false });
		}

		return () => {
			if (container) {
				container.removeEventListener('wheel', handleWheel);
			}
		};
	}, []);

	if (loading) return <Loading title="Loading Topology" />;

	return (
		<div className="flex flex-col flex-1 w-full">
			<div id="canbus-topology-container" className="w-full overflow-x-auto pb-64 flex-1 flex flex-col gap-12">
				{topology.length === 0 && editing && (
					<div className="p-8">
						<Button onClick={() => beginInsertNewBusLine()} icon={<Plus size={20} />}>
							Add First Bus Line
						</Button>
					</div>
				)}
				{topology.map((busLine, index) => (
					<div key={index} className="flex flex-row items-start min-w-max relative" style={{ zoom }}>
						{/* Root insertion button */}
						{editing && busLine.length > 0 && (
							<div className="absolute -left-12 top-[10rem] flex flex-col justify-center h-2.5 w-12 group print:hidden">
								<div className="h-0.75 w-full bg-orange-500" />
								<div className="h-0.75 w-full bg-orange-200" />
								<button
									onClick={() => beginInsertRoot(index)}
									className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:scale-110 shadow-sm"
								>
									<Plus size={14} />
								</button>
							</div>
						)}

						{renderSerialLine(busLine)}
					</div>
				))}
			</div>

			{dockNode &&
				createPortal(
					<>
						<div className="relative hidden sm:flex items-center sm:w-auto sm:min-w-[300px]">
							<Input
								placeholder="Search modules..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="!pr-[120px] bg-[var(--foreground)] border-none shadow-sm w-full"
							/>
							{search && matches.length > 0 && (
								<div className="absolute right-2 flex items-center gap-1 text-sm text-[var(--text-muted)] z-10">
									<span className="mr-1 font-medium hidden sm:inline">
										{searchIndex + 1}/{matches.length}
									</span>
									<Button
										size="sm"
										variant="ghost"
										className="h-8 w-8 p-0 rounded-full hover:bg-[var(--border)]/10 text-[var(--text)]"
										icon={<ChevronLeft size={20} />}
										onClick={() => setSearchIndex((i) => (i > 0 ? i - 1 : matches.length - 1))}
									/>
									<Button
										size="sm"
										variant="ghost"
										className="h-8 w-8 p-0 rounded-full hover:bg-[var(--border)]/10 text-[var(--text)]"
										icon={<ChevronRight size={20} />}
										onClick={() => setSearchIndex((i) => (i < matches.length - 1 ? i + 1 : 0))}
									/>
								</div>
							)}
							{search && matches.length === 0 && <div className="absolute right-4 text-sm text-[var(--text-muted)] z-10 font-medium hidden sm:block">0/0</div>}
						</div>

						<div className="w-px h-6 bg-[var(--border)]/20 mx-1 hidden sm:block" />

						<div className="flex items-center gap-2 sm:gap-3 justify-center">
							<Button
								disabled={noProgrammation}
								variant="secondary"
								onClick={() => setViewMode((v) => (v === 'setup' ? 'sim' : 'setup'))}
								icon={viewMode === 'setup' ? <Settings size={16} /> : <Activity size={16} />}
							>
								<span className="hidden sm:inline">{viewMode === 'setup' ? 'Setup' : 'Simulation'}</span>
							</Button>

							<div className="w-px h-8 bg-[var(--border)]/20 mx-1 hidden sm:block" />

							{has('projects.write') && <Button onClick={() => setEditing(!editing)} className="shadow-sm px-3" icon={editing ? <Save size={16} /> : <Pencil size={16} />} />}

							{has('projects.write') && editing && (
								<Button onClick={() => beginInsertNewBusLine()} className="shadow-sm px-3" icon={<Plus size={16} />}>
									<span className="hidden sm:inline">{viewMode === 'setup' ? `${unplacedModules.length} unplaced` : 'Add Bus Line'}</span>
									<span className="sm:hidden">{viewMode === 'setup' ? unplacedModules.length : 'Add'}</span>
								</Button>
							)}

							<div className="w-px h-8 bg-[var(--border)]/20 mx-1 hidden sm:block" />

							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									className="rounded-full h-8 w-8 sm:h-10 sm:w-10 p-0 hover:bg-[var(--foreground)] shrink-0"
									icon={<Minus size={18} />}
									onClick={() => setZoom((z) => Math.max(0.05, z - 0.25))}
								/>
								<span className="text-xs sm:text-sm font-semibold w-10 sm:w-12 text-center text-[var(--text)]">{Math.round(zoom * 100)}%</span>
								<Button
									variant="ghost"
									className="rounded-full h-8 w-8 sm:h-10 sm:w-10 p-0 hover:bg-[var(--foreground)] shrink-0"
									icon={<Plus size={18} />}
									onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
								/>
							</div>

							<div className="w-px h-8 bg-[var(--border)]/20 mx-1 hidden sm:block" />

							<div className="flex items-center gap-1">
								<Button
									size="sm"
									variant="ghost"
									className="text-xs sm:px-3 px-2"
									disabled={printing}
									icon={printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
									onClick={async () => {
										const container = document.getElementById('canbus-topology-container');
										if (!container) return;

										const innerContent = container.querySelector('.flex-row.items-start.min-w-max');
										if (!innerContent) return;

										setPrinting(true);

										try {
											const oldZoom = (innerContent as HTMLElement).style.zoom;
											(innerContent as HTMLElement).style.zoom = '1';

											const rect = innerContent.getBoundingClientRect();
											// Use scrollWidth to capture the ENTIRE tree even if it's off-screen in the scroll container
											const scrollWidth = innerContent.scrollWidth + 40;
											const scrollHeight = innerContent.scrollHeight + 40;

											(innerContent as HTMLElement).style.zoom = oldZoom;

											// A3 Landscape dimensions (slightly reduced to account for Chrome's physical printer margins)
											const pageW = 1450;
											const pageH = 1040;

											// We want to avoid slicing cards in half across pages.
											// A card column is exactly 328px wide (280px card + 48px horizontal line).
											// By calculating a scale factor that makes `pageW` an exact multiple of 328px,
											// the page cut will ALWAYS fall cleanly in the 48px horizontal line gap between cards!
											const requiredScale = Math.min(0.8, pageH / scrollHeight);
											const cardsPerPage = Math.ceil(pageW / (requiredScale * 328));
											const scaleFactor = pageW / (cardsPerPage * 328);

											const scaledWidth = scrollWidth * scaleFactor;
											const numPages = Math.ceil(scaledWidth / pageW);

											const tiler = document.createElement('div');
											tiler.id = 'print-tiler';
											tiler.style.cssText = 'position: absolute; top: 0; left: 0; z-index: -100; opacity: 0; pointer-events: none;';

											for (let i = 0; i < numPages; i++) {
												const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
												svg.setAttribute('width', `${pageW}`);
												svg.setAttribute('height', `${pageH}`);
												svg.style.cssText = `
											width: ${pageW}px;
											height: ${pageH}px;
											${i < numPages - 1 ? 'page-break-after: always; break-after: page;' : ''}
											display: block;
											overflow: hidden;
										`;

												// The foreignObject MUST be exactly pageW to hide the wide layout from Chrome's print engine
												const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
												foreignObject.setAttribute('width', `${pageW}`);
												foreignObject.setAttribute('height', `${pageH}`);
												foreignObject.setAttribute('x', `0`);
												foreignObject.setAttribute('y', `0`);

												const cloneWrapper = document.createElement('div');
												cloneWrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

												// Shift the content horizontally using CSS transform inside the SVG
												const translateX = -(i * pageW) / scaleFactor;
												// Vertically center the content on the page if it's smaller than the page height
												const translateY = (pageH - scrollHeight * scaleFactor) / 2 / scaleFactor;

												cloneWrapper.style.cssText = `
											width: ${scrollWidth}px;
											height: ${scrollHeight}px;
											padding: 20px;
											box-sizing: border-box;
											transform: scale(${scaleFactor}) translate(${translateX}px, ${translateY}px);
											transform-origin: top left;
											background: white;
										`;

												const clone = innerContent.cloneNode(true) as HTMLElement;
												clone.style.cssText = `
											width: ${scrollWidth}px !important;
											margin: 0 !important;
											display: flex !important;
											flex-wrap: nowrap !important;
										`;

												cloneWrapper.appendChild(clone);
												foreignObject.appendChild(cloneWrapper);
												svg.appendChild(foreignObject);
												tiler.appendChild(svg);
											}

											document.body.appendChild(tiler);

											const style = document.createElement('style');
											style.innerHTML = `
										@page { size: A3 landscape; margin: 10mm; }
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
									}}
								>
									<span className="hidden sm:inline">{printing ? 'Preparing...' : 'Print'}</span>
								</Button>
							</div>
						</div>
					</>,
					dockNode
				)}

			<Modal
				size={'xxl'}
				open={addModalOpen}
				onClose={() => {
					setAddModalOpen(false);
					setModuleSearch('');
				}}
				title="Add Module"
			>
				<div className="mb-4">
					<Input placeholder="Search modules..." value={moduleSearch} onChange={(e) => setModuleSearch(e.target.value)} className="w-full" />
				</div>
				<div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2">
					{viewMode === 'setup' ? (
						<>
							<div>
								<h3 className="mb-4 text-lg font-semibold">Detected Modules ({unplacedModules.length})</h3>

								<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
									{unplacedModules.map((node) => (
										<Card key={node.physicalAddress} onClick={() => selectDetectedModule(node)} className="cursor-pointer transition hover:scale-[1.02]">
											<div className="flex flex-col gap-4 p-2">
												<div>
													<h4 className="font-semibold">{node.name}</h4>

													<p className="text-sm opacity-70">
														{node.physicalAddress} - {node.nodeAddress}
													</p>

													<p className="text-sm opacity-70">{node.numberOfUnits} units</p>
												</div>
											</div>
										</Card>
									))}
								</div>
							</div>

							<div>
								<h3 className="mb-4 text-lg font-semibold">Infrastructure</h3>

								<motion.div layout className="space-y-6">
									<AnimatePresence>
										{groupedManualModules.map(([category, modules]) => (
											<motion.div
												key={category}
												layout
												initial={{ opacity: 0, height: 0 }}
												animate={{ opacity: 1, height: 'auto' }}
												exit={{ opacity: 0, height: 0 }}
												className="overflow-hidden"
											>
												<h4 className="mb-3 font-medium opacity-80 capitalize">{category}</h4>
												<motion.div layout className="grid grid-cols-1 gap-4 lg:grid-cols-3">
													<AnimatePresence>
														{modules.map((module) => (
															<motion.div
																key={module.id}
																layout
																initial={{ opacity: 0, scale: 0.8 }}
																animate={{ opacity: 1, scale: 1 }}
																exit={{ opacity: 0, scale: 0.8 }}
																transition={{ duration: 0.15 }}
															>
																<Card onClick={() => addManualModule(module)} className="cursor-pointer transition hover:scale-[1.02] h-full">
																	<div className="flex flex-col gap-4 p-2 h-full">
																		<div className="rounded-lg p-1 overflow-hidden max-h-70">
																			<ReactSVG src={`/modules/${module.id}/drawing.svg`} className="h-100 w-auto" />
																		</div>

																		<div>
																			<h4 className="font-semibold">{module.name}</h4>

																			<p className="text-sm opacity-70 line-clamp-3">{module.description}</p>
																		</div>
																	</div>
																</Card>
															</motion.div>
														))}
													</AnimatePresence>
												</motion.div>
											</motion.div>
										))}
									</AnimatePresence>
								</motion.div>
							</div>
						</>
					) : (
						<div>
							<h3 className="mb-4 text-lg font-semibold">Simulated Modules</h3>

							<motion.div layout className="space-y-6">
								<AnimatePresence>
									{groupedAvailableModules.map(([category, modules]) => (
										<motion.div
											key={category}
											layout
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: 'auto' }}
											exit={{ opacity: 0, height: 0 }}
											className="overflow-hidden"
										>
											<h4 className="mb-3 font-medium opacity-80 capitalize">{category}</h4>
											<motion.div layout className="grid grid-cols-1 gap-4 lg:grid-cols-3">
												<AnimatePresence>
													{modules.map((module) => (
														<motion.div
															key={module.id}
															layout
															initial={{ opacity: 0, scale: 0.8 }}
															animate={{ opacity: 1, scale: 1 }}
															exit={{ opacity: 0, scale: 0.8 }}
															transition={{ duration: 0.15 }}
														>
															<Card onClick={() => addManualModule(module)} className="cursor-pointer transition hover:scale-[1.02] h-full">
																<div className="flex flex-col gap-4 p-2 h-full">
																	<div className="rounded-lg p-1 overflow-hidden max-h-70">
																		<ReactSVG src={`/modules/${module.id}/drawing.svg`} className="h-100 w-auto" />
																	</div>

																	<div>
																		<h4 className="font-semibold">{module.name}</h4>

																		<p className="text-sm opacity-70 line-clamp-3">{module.description}</p>
																	</div>
																</div>
															</Card>
														</motion.div>
													))}
												</AnimatePresence>
											</motion.div>
										</motion.div>
									))}
								</AnimatePresence>
							</motion.div>
						</div>
					)}
				</div>
			</Modal>

			<Modal
				open={moduleSelection !== null}
				size={'xxl'}
				onClose={() => {
					setModuleSelection(null);
					setModuleSearch('');
				}}
				title="Select Module Type"
			>
				<div className="mb-4">
					<Input placeholder="Search modules..." value={moduleSearch} onChange={(e) => setModuleSearch(e.target.value)} className="w-full" />
				</div>
				<div className="space-y-6">
					<div>
						<h3 className="font-semibold">
							{moduleSelection?.mode === 'add' ? moduleSelection.node.name : availableModules.find((x) => x.id === moduleSelection?.topology.moduleId)?.name}
						</h3>

						<p className="opacity-70">
							{moduleSelection?.mode === 'add' ? moduleSelection.node.physicalAddress : moduleSelection?.topology.physicalAddress}
							{' - '}
							{moduleSelection?.mode === 'add' && moduleSelection?.node?.nodeAddress}
						</p>
					</div>

					<motion.div layout className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
						<AnimatePresence>
							{groupedDetectableModules.map(([category, modules]) => (
								<motion.div
									key={category}
									layout
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: 'auto' }}
									exit={{ opacity: 0, height: 0 }}
									className="overflow-hidden"
								>
									<h4 className="mb-3 font-medium opacity-80 capitalize">{category}</h4>
									<motion.div layout className="grid grid-cols-1 gap-4 lg:grid-cols-3">
										<AnimatePresence>
											{modules.map((module) => (
												<motion.div
													key={module.id}
													layout
													initial={{ opacity: 0, scale: 0.8 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.8 }}
													transition={{ duration: 0.15 }}
												>
													<Card
														onClick={() => (moduleSelection?.mode === 'add' ? addDetectedModule(module) : changeModuleType(module))}
														className="cursor-pointer transition hover:scale-[1.02] h-full"
													>
														<div className="flex flex-col gap-4 p-2 h-full">
															<div className="rounded-lg p-1 overflow-hidden max-h-70">
																<ReactSVG src={`/modules/${module.id}/drawing.svg`} className="h-100 w-auto" />
															</div>

															<div>
																<h4 className="font-semibold">{module.name}</h4>

																<p className="text-sm opacity-70 line-clamp-3">{module.description}</p>
															</div>
														</div>
													</Card>
												</motion.div>
											))}
										</AnimatePresence>
									</motion.div>
								</motion.div>
							))}
						</AnimatePresence>
					</motion.div>
				</div>
			</Modal>

			<Modal size="xl" open={unitModal !== null} onClose={() => setUnitModal(null)} title={`${unitModal?.name} Units`}>
				<div className="max-h-[70vh] overflow-y-auto p-2">
					<div className="grid gap-3 md:grid-cols-2">
						{unitModal?.units.map((unit: any, index: number) => {
							return (
								<Card key={index}>
									<div className="flex justify-between items-center p-2" key={index}>
										<div>
											<h4 className="font-semibold">{unit.name}</h4>

											<p className="text-sm opacity-70">Channel {unit.unitAddress}</p>
										</div>

										<div className="text-right text-sm opacity-70">
											<div>{units[unit.unitTypeName as keyof typeof units] || unit.unitTypeName}</div>
										</div>
									</div>
								</Card>
							);
						})}
					</div>
				</div>
			</Modal>

			<Modal size="xl" open={bindingsModal !== null} onClose={() => setBindingsModal(null)} title={`${bindingsModal?.name} Input Bindings`}>
				<div className="max-h-[70vh] overflow-y-auto p-2">
					<div className="flex flex-col gap-4">
						{bindingsModal?.units.map((unit: any, index: number) => {
							const addrKey = `${bindingsModal.nodeAddress};${unit.unitAddress}`;

							const unitBindings = bindingsData.filter((b) => b.inputs.some((i: any) => i.Address?.startsWith(addrKey)));

							if (unitBindings.length === 0) return null;

							return (
								<Card key={index} className="p-4">
									<h4 className="font-semibold text-lg border-b pb-2 mb-3">
										{unit.name} <span className="opacity-50 font-normal text-sm ml-2">(Ch {unit.unitAddress})</span>
									</h4>

									<div className="space-y-4">
										{unitBindings.map((b: any, bIdx: number) => {
											const inputEvent = b.inputs.find((i: any) => i.Address?.startsWith(addrKey))?.Event;
											let eventLabel = 'Unknown Event';
											if (inputEvent === '0x01') eventLabel = 'Long Event';
											else if (inputEvent === '0x03' || inputEvent === '0x02') eventLabel = 'Short Pulse';
											else if (inputEvent) eventLabel = `Event: ${inputEvent}`;

											return (
												<div key={bIdx} className="bg-[var(--foreground)] rounded-md p-3">
													<div className="flex items-center justify-between mb-2">
														<span className="font-medium text-sm text-[var(--accent)]">{eventLabel}</span>
														<span className="text-xs opacity-50">{b.BindingStrName}</span>
													</div>

													<div className="text-sm space-y-1">
														<div className="font-medium mb-1">Triggers Outputs:</div>
														{b.outputs.length === 0 && <span className="opacity-50 italic">None</span>}
														{b.outputs.map((out: any, oIdx: number) => (
															<div key={oIdx} className="flex items-center gap-2 text-[var(--text-muted)]">
																<div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/50" />
																<span>{out.unitInfo}</span>
															</div>
														))}
													</div>
												</div>
											);
										})}
									</div>
								</Card>
							);
						})}

						{bindingsModal?.units.every((unit: any) => !bindingsData.some((b) => b.inputs.some((i: any) => i.Address?.startsWith(`${bindingsModal.nodeAddress};${unit.unitAddress}`)))) && (
							<div className="text-center py-8 opacity-50">No input bindings found for this node.</div>
						)}
					</div>
				</div>
			</Modal>

			<Modal open={simulatedModuleNaming !== null} onClose={() => setSimulatedModuleNaming(null)} title="Name Simulated Module">
				<div className="space-y-4">
					<p className="text-sm">Enter a name for this simulated {simulatedModuleNaming?.name}:</p>
					<Input
						value={simulatedModuleName}
						onChange={(e) => setSimulatedModuleName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') confirmSimulatedModule();
						}}
						autoFocus
					/>
					<div className="flex justify-end gap-2 mt-4">
						<Button variant="secondary" onClick={() => setSimulatedModuleNaming(null)}>
							Cancel
						</Button>
						<Button onClick={confirmSimulatedModule}>Add Module</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
