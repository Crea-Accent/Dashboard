'use client';

import { Info, Printer, Pointer, SunDim, Zap, Hand, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { linkNodeUnitsWithBindings } from '@/lib/duotecno';
import { ReactSVG } from 'react-svg';

export default function Controls({ basePath, client }: { basePath: string; client: string }) {
	const [projectSetup, setProjectSetup] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [nodesData, setNodesData] = useState<any[]>([]);
	const [bindingsData, setBindingsData] = useState<any[]>([]);
	const [bindingsModal, setBindingsModal] = useState<any | null>(null);

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

	if (loading) {
		return (
			<div className="flex items-center justify-center p-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--accent)" />
			</div>
		);
	}

	const allModules: any[] = [];
	if (projectSetup) {
		const extract = (node: any) => {
			if (Array.isArray(node)) {
				for (const child of node) extract(child);
			} else {
				allModules.push(node);
				if (node.nodes) {
					for (const branch of Object.values(node.nodes)) {
						extract(branch);
					}
				}
			}
		};
		extract(projectSetup);
	}

	const hasExplicitButtons = allModules.some((m) => ['DTBS-4x', 'DT1ET-4x', 'DT1C-4x'].includes(m.moduleId));

	return (
		<div className="space-y-4 max-w-7xl mx-auto w-full">
			<div className="flex justify-between items-center mb-2">
				<div className="flex items-center gap-4 text-sm">
					<div className="flex items-center gap-2 border border-(--border)/20 rounded-full px-3 py-1 text-xs font-medium">
						<Hand className="text-pink-500" size={14} /> Pulse
					</div>
					<div className="flex items-center gap-2 border border-(--border)/20 rounded-full px-3 py-1 text-xs font-medium">
						<Sun className="text-pink-500" size={14} /> Long Hold
					</div>
				</div>
				<Button onClick={() => window.print()} variant="ghost" className="print:hidden" icon={<Printer size={16} />}>
					Print Layout
				</Button>
			</div>

			<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 print:flex print:flex-wrap print:gap-4">
				{hasExplicitButtons
					? allModules
							.filter((module) => ['DTBS-4x', 'DT1ET-4x', 'DT1C-4x'].includes(module.moduleId))
							.map((button) => {
								const node = nodesData.find((n) => n.physicalAddress === button.physicalAddress);

								const getUnitContent = (idx: number) => {
									if (!node || !node.units || !node.units[idx]) return null;
									const unit = node.units[idx];
									const addrKey = `${node.nodeAddress};${unit.unitAddress}`;
									const unitBindings = bindingsData.filter((b) => b.inputs.some((i: any) => i.Address?.startsWith(addrKey)));

									if (unitBindings.length > 0) {
										return (
											<div className="flex flex-col gap-2 items-center justify-center w-full">
												{unitBindings.map((b, i) => {
													const inputEvent = b.inputs.find((input: any) => input.Address?.startsWith(addrKey))?.Event;
													let Icon = Zap;
													if (inputEvent === '0x01')
														Icon = SunDim; // Long Event
													else if (inputEvent === '0x03' || inputEvent === '0x02') Icon = Pointer; // Short Pulse

													const bindingName = (b.BindingStrName || '').replace(/['"]/g, '');

													const outputs =
														b.outputs && b.outputs.length > 0
															? Array.from(
																	new Set(
																		b.outputs.map((out: any) => {
																			let name = out.unitInfo || '';
																			if (name.includes('Unit: ')) name = name.split('Unit: ')[1];
																			return name.replace(/^,/, '').trim();
																		})
																	)
																)
															: [bindingName.replace(/\s+[PLS]$/i, '')];

													return (
														<div
															key={i}
															className="flex flex-row items-center w-full justify-center gap-2 min-w-0"
															title={`Binding: ${bindingName} (Event: ${inputEvent})`}
														>
															<Icon size={16} className="shrink-0 text-(--accent)" />
															<div className="flex flex-col items-start justify-center min-w-0">
																{outputs.map((outName, oIdx) => (
																	<span
																		key={oIdx}
																		className="text-xs sm:text-sm font-medium leading-tight truncate max-w-full text-left print:whitespace-normal print:overflow-visible print:!text-black"
																	>
																		{outName as string}
																	</span>
																))}
															</div>
														</div>
													);
												})}
											</div>
										);
									}

									return null;
								};

								return (
									<Card key={button.instanceId} className="p-1.5 flex flex-col h-full print:shadow-none print:border print:border-gray-200 print:w-[48%] print:break-inside-avoid">
										<div className="flex justify-between items-start mb-2 px-2 pt-2 shrink-0 print-force-black print:block">
											<div>
												<h2
													className="text-xl font-semibold leading-tight print:text-black print-force-black"
													style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}
												>
													{node ? node.name : button.physicalAddress}
												</h2>
												<p className="text-sm text-[var(--text-muted)] print:text-black print-force-black" style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}>
													{button.physicalAddress}
												</p>
											</div>
											<Button size="sm" variant="ghost" icon={<Info size={14} />} onClick={() => setBindingsModal(node)} className="print:hidden" />
										</div>

										<div className="relative w-full aspect-square print:aspect-auto print:h-0 print:pb-[100%] bg-[var(--background)] print:bg-transparent rounded-xl border border-[var(--border)]/10 print:border-gray-200 overflow-hidden ">
											<ReactSVG
												src="/modules/DTBS-4x/drawing.svg"
												className="absolute inset-0 w-full h-full p-1 [&>div]:w-full [&>div]:h-full [&_svg]:w-full [&_svg]:h-full opacity-20 print:opacity-40 pointer-events-none"
											/>
											<div className="absolute inset-0 grid grid-cols-2 grid-rows-2 p-[12%] gap-2">
												<div className="flex items-center justify-center z-10 w-full h-full overflow-hidden">{getUnitContent(0)}</div>
												<div className="flex items-center justify-center z-10 w-full h-full overflow-hidden">{getUnitContent(2)}</div>
												<div className="flex items-center justify-center z-10 w-full h-full overflow-hidden">{getUnitContent(1)}</div>
												<div className="flex items-center justify-center z-10 w-full h-full overflow-hidden">{getUnitContent(3)}</div>
											</div>
										</div>
									</Card>
								);
							})
					: nodesData
							.filter((node) => {
								if (node.nodeTypeName !== 'Std. Node') return false;
								const controlCount = (node.units || []).filter((u: any) => u.unitTypeName === 'Control').length;
								return controlCount >= 4;
							})
							.map((node, index) => {
								const getUnitContent = (idx: number) => {
									if (!node || !node.units || !node.units[idx]) return null;
									const unit = node.units[idx];
									const addrKey = `${node.nodeAddress};${unit.unitAddress}`;
									const unitBindings = bindingsData.filter((b) => b.inputs.some((i: any) => i.Address?.startsWith(addrKey)));

									if (unitBindings.length > 0) {
										return (
											<div className="flex flex-col gap-2 items-center justify-center w-full">
												{unitBindings.map((b, i) => {
													const inputEvent = b.inputs.find((input: any) => input.Address?.startsWith(addrKey))?.Event;
													let Icon = Zap;
													if (inputEvent === '0x01')
														Icon = SunDim; // Long Event
													else if (inputEvent === '0x03' || inputEvent === '0x02') Icon = Pointer; // Short Pulse

													const bindingName = (b.BindingStrName || '').replace(/['"]/g, '');

													const outputs =
														b.outputs && b.outputs.length > 0
															? Array.from(
																	new Set(
																		b.outputs.map((out: any) => {
																			let name = out.unitInfo || '';
																			if (name.includes('Unit: ')) name = name.split('Unit: ')[1];
																			return name.replace(/^,/, '').trim();
																		})
																	)
																)
															: [bindingName.replace(/\s+[PLS]$/i, '')];

													return (
														<div
															key={i}
															className="flex flex-row items-center w-full justify-center gap-2 min-w-0"
															title={`Binding: ${bindingName} (Event: ${inputEvent})`}
														>
															<Icon size={16} className="shrink-0 text-(--accent)" />
															<div className="flex flex-col items-start justify-center min-w-0">
																{outputs.map((outName, oIdx) => (
																	<span
																		key={oIdx}
																		className="text-xs sm:text-sm font-medium leading-tight truncate max-w-full text-left print:whitespace-normal print:overflow-visible print:!text-black"
																	>
																		{outName as string}
																	</span>
																))}
															</div>
														</div>
													);
												})}
											</div>
										);
									}

									return null;
								};

								return (
									<Card
										key={node.physicalAddress || index}
										className="p-1.5 flex flex-col h-full print:shadow-none print:border print:border-gray-200 print:w-[48%] print:break-inside-avoid"
									>
										<div className="flex justify-between items-start mb-2 px-2 pt-2 shrink-0 print-force-black print:block">
											<div>
												<h2
													className="text-xl font-semibold leading-tight print:text-black print-force-black"
													style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}
												>
													{node.name}
												</h2>
												<p className="text-sm text-[var(--text-muted)] print:text-black print-force-black" style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}>
													{node.physicalAddress}
												</p>
											</div>
											<Button size="sm" variant="ghost" icon={<Info size={14} />} onClick={() => setBindingsModal(node)} className="print:hidden" />
										</div>

										<div className="relative w-full aspect-square print:aspect-auto print:h-0 print:pb-[100%] bg-[var(--background)] print:bg-transparent rounded-xl border border-[var(--border)]/10 print:border-gray-200 overflow-hidden ">
											<ReactSVG
												src="/modules/DTBS-4x/drawing.svg"
												className="absolute inset-0 w-full h-full p-1 [&>div]:w-full [&>div]:h-full [&_svg]:w-full [&_svg]:h-full opacity-20 print:opacity-40 pointer-events-none"
											/>
											<div className="absolute inset-0 grid grid-cols-2 grid-rows-2 p-[12%] gap-2">
												<div className="flex items-center justify-center z-10 w-full h-full overflow-hidden">{getUnitContent(0)}</div>
												<div className="flex items-center justify-center z-10 w-full h-full overflow-hidden">{getUnitContent(2)}</div>
												<div className="flex items-center justify-center z-10 w-full h-full overflow-hidden">{getUnitContent(1)}</div>
												<div className="flex items-center justify-center z-10 w-full h-full overflow-hidden">{getUnitContent(3)}</div>
											</div>
										</div>
									</Card>
								);
							})}
			</div>

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
								</Card>
							);
						})}
					</div>
				</div>
			</Modal>
		</div>
	);
}
