'use client';

import { Info, Pointer, SunDim, Zap, Hand, Sun, Search, Filter, X } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { linkNodeUnitsWithBindings } from '@/lib/duotecno';
import { ReactSVG } from 'react-svg';

export default function Controls({ basePath, client, onActionsChange }: { basePath: string; client: string; onActionsChange?: (actions: any) => void }) {
	const [projectSetup, setProjectSetup] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [printing, setPrinting] = useState(false);
	const [nodesData, setNodesData] = useState<any[]>([]);
	const [bindingsData, setBindingsData] = useState<any[]>([]);
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
			clone.className = 'flex flex-wrap gap-4 w-full';
			tiler.appendChild(clone);
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
	};

	useEffect(() => {
		let isMounted = true;

		async function load() {
			try {
				setLoading(true);
				const programmationPath = `${basePath}/${client}/Programmation`;

				const files = await fetch(`/api/files?view=${encodeURIComponent(programmationPath)}&recursive=1`).then((r) => r.json());

				let latestFolder = null;
				if (Array.isArray(files)) {
					const projectFolders = Array.from(
						new Set(files.filter((f: any) => f.type === 'file' && f.name.toLowerCase().endsWith('.duo')).map((f: any) => f.path.split(/[\\/]/).slice(0, -1).join('/')))
					) as string[];

					latestFolder = projectFolders
						.map((folder: string) => {
							const folderName = folder.split(/[\\/]/).pop() ?? '';
							const [, date] = folderName.split('__');
							return { folder, date: date ?? '00000000' };
						})
						.sort((a, b) => b.date.localeCompare(a.date))[0]?.folder;
				}

				if (latestFolder) {
					const nodeDatabase = await fetch(`/api/files/download?path=${encodeURIComponent(`${latestFolder}/Config/nodedatabase.cache.json`)}`).then((r) => r.json());

					const bindingTxt = await fetch(`/api/files/download?path=${encodeURIComponent(`${latestFolder}/Config/bindingconfiginfo.txt`)}`).then((r) => r.text());
					const canbusData = await fetch(`/api/projects/canbus?client=${encodeURIComponent(client)}`)
						.then((r) => r.json())
						.catch(() => null);

					if (isMounted) {
						setNodesData(nodeDatabase.nodes ?? []);
						setBindingsData(linkNodeUnitsWithBindings(JSON.stringify(nodeDatabase), bindingTxt));
						setProjectSetup(canbusData?.setup);
					}
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
	}, [basePath, client]);

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
				if (node.nodeTypeName !== 'Std. Node') return false;
				const controlCount = (node.units || []).filter((u: any) => u.unitTypeName === 'Control').length;
				return controlCount >= 4;
			})
			.map((node, index) => ({
				key: node.physicalAddress || String(index),
				name: node.name || node.physicalAddress,
				physicalAddress: node.physicalAddress,
				node,
			}));
	}, [hasExplicitButtons, allModules, nodesData]);

	// Helper to inspect a switch's 4 quadrants (indices 0, 1, 2, 3)
	const getUnitBindingsForIdx = (node: any, idx: number) => {
		if (!node || !node.units || !node.units[idx]) return [];
		const unit = node.units[idx];
		const addrKey = `${node.nodeAddress};${unit.unitAddress}`;
		return bindingsData.filter((b) => b.inputs.some((i: any) => i.Address?.startsWith(addrKey)));
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

	const switchHasBindings = (node: any) => {
		if (!node) return false;
		return [0, 1, 2, 3].some((idx) => getUnitBindingsForIdx(node, idx).length > 0);
	};

	const quadrantMatchesSearch = (node: any, idx: number, q: string) => {
		if (!q) return false;
		const term = q.toLowerCase();
		const unit = node?.units?.[idx];
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
				<div id="controls-grid" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 print:flex print:flex-wrap print:gap-4">
					{filteredSwitches.map((entry) => {
						const { node } = entry;

						const renderQuadrant = (idx: number) => {
							const unit = node?.units?.[idx];
							const addrKey = node && unit ? `${node.nodeAddress};${unit.unitAddress}` : '';
							const unitBindings = getUnitBindingsForIdx(node, idx);
							const isHighlighted = qTrim.length > 0 && quadrantMatchesSearch(node, idx, qTrim);

							return (
								<div
									onClick={() => {
										if (node) {
											setFocusedChannel(idx);
											setBindingsModal(node);
										}
									}}
									title={unit ? `${unit.name} — Click to inspect bindings` : undefined}
									className={`flex items-center justify-center z-10 w-full h-full overflow-hidden rounded-lg transition-all ${
										node ? 'cursor-pointer hover:bg-[var(--accent)]/5' : ''
									} ${isHighlighted ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/10 print:ring-0 print:bg-transparent' : ''}`}
								>
									{unitBindings.length > 0 ? (
										<div className="flex flex-col gap-2 items-center justify-center w-full px-1">
											{unitBindings.map((b, i) => {
												const inputEvent = b.inputs.find((input: any) => input.Address?.startsWith(addrKey))?.Event;
												let Icon = Zap;
												if (inputEvent === '0x01')
													Icon = SunDim; // Long Event
												else if (inputEvent === '0x03' || inputEvent === '0x02') Icon = Pointer; // Short Pulse

												const bindingName = (b.BindingStrName || '').replace(/['"]/g, '');
												const outputs = getOutputsForBinding(b);

												return (
													<div key={i} className="flex flex-row items-center w-full justify-center gap-2 min-w-0" title={`Binding: ${bindingName} (Event: ${inputEvent})`}>
														<Icon size={16} className="shrink-0 text-(--accent)" />
														<div className="flex flex-col items-start justify-center min-w-0">
															{outputs.map((outName, oIdx) => (
																<span
																	key={oIdx}
																	className="text-xs sm:text-sm font-medium leading-tight truncate max-w-full text-left print:whitespace-normal print:overflow-visible print:!text-black"
																>
																	{outName}
																</span>
															))}
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
							<Card key={entry.key} className="p-1.5 flex flex-col h-full print:shadow-none print:border print:border-gray-200 print:w-[48%] print:break-inside-avoid">
								<div className="flex justify-between items-start mb-2 px-2 pt-2 shrink-0 print-force-black print:block">
									<div>
										<h2 className="text-xl font-semibold leading-tight print:text-black print-force-black" style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}>
											{entry.name}
										</h2>
										<p className="text-sm text-[var(--text-muted)] print:text-black print-force-black" style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}>
											{entry.physicalAddress}
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
											className="print:hidden"
										/>
									)}
								</div>

								<div className="relative w-full aspect-square print:aspect-auto print:h-0 print:pb-[100%] bg-[var(--background)] print:bg-transparent rounded-xl border border-[var(--border)]/10 print:border-gray-200 overflow-hidden">
									<ReactSVG
										src="/modules/DTBS-4x/drawing.svg"
										className="absolute inset-0 w-full h-full p-1 [&>div]:w-full [&>div]:h-full [&_svg]:w-full [&_svg]:h-full opacity-20 print:opacity-40 pointer-events-none"
									/>
									<div className="absolute inset-0 grid grid-cols-2 grid-rows-2 p-[12%] gap-2">
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
				<div className="max-h-[70vh] overflow-y-auto p-2">
					{focusedChannel !== null && (
						<div className="mb-3 flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-xs">
							<span className="font-medium text-[var(--accent)]">
								Viewing Button Quadrant #{focusedChannel + 1} ({bindingsModal?.units?.[focusedChannel]?.name || `Ch ${focusedChannel}`})
							</span>
							<button type="button" onClick={() => setFocusedChannel(null)} className="font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
								Show All Channels
							</button>
						</div>
					)}
					<div className="flex flex-col gap-4">
						{bindingsModal?.units.map((unit: any, index: number) => {
							if (focusedChannel !== null && index !== focusedChannel) return null;

							const addrKey = `${bindingsModal.nodeAddress};${unit.unitAddress}`;
							const unitBindings = bindingsData.filter((b) => b.inputs.some((i: any) => i.Address?.startsWith(addrKey)));

							if (unitBindings.length === 0 && focusedChannel === null) return null;

							return (
								<Card key={index} className="p-4">
									<h4 className="font-semibold text-lg border-b pb-2 mb-3">
										{unit.name} <span className="opacity-50 font-normal text-sm ml-2">(Ch {unit.unitAddress})</span>
									</h4>

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

												return (
													<div key={bIdx} className="bg-[var(--foreground)] rounded-md p-3">
														<div className="flex items-center justify-between mb-2">
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
