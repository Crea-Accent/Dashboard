/** @format */
'use client';

import { APIProvider, AdvancedMarker, Map, MapMouseEvent, useMap } from '@vis.gl/react-google-maps';
import { PanelTop, Sun, Zap, Trash2, RotateCcw, Settings, Activity, ChevronDown, Save, Grid, Loader2 } from 'lucide-react';
import { useEffect, useState, useMemo, useRef, MouseEvent as ReactMouseEvent } from 'react';

import Selector from '@/components/ui/Selector';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import EmptyState from '../ui/EmptyState';
import Loading from '../ui/Loading';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermissions } from '@/providers/PermissionsProvider';
import { useDebug } from '@/providers/DebugProvider';
import { createPortal } from 'react-dom';

type Props = {
	client: string;
};

type CustomPanel = {
	lat: number;
	lng: number;
	azimuth: number;
};

const EARTH_RADIUS = 6378137;
const GAP_METERS = 0; // Exactly touching

function getOffsetsInMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
	const latDiff = lat2 - lat1;
	const lngDiff = lng2 - lng1;
	const y = latDiff * (Math.PI / 180) * EARTH_RADIUS;
	const x = lngDiff * (Math.PI / 180) * EARTH_RADIUS * Math.cos((lat1 * Math.PI) / 180);
	return { x, y };
}

function applyOffsetsInMeters(lat1: number, lng1: number, x: number, y: number) {
	const lat2 = lat1 + (y / EARTH_RADIUS) * (180 / Math.PI);
	const lng2 = lng1 + (x / (EARTH_RADIUS * Math.cos((lat1 * Math.PI) / 180))) * (180 / Math.PI);
	return { lat: lat2, lng: lng2 };
}

function snapToGrid(targetLat: number, targetLng: number, anchorLat: number, anchorLng: number, azimuth: number, width: number, length: number) {
	const { x, y } = getOffsetsInMeters(anchorLat, anchorLng, targetLat, targetLng);

	// Google Maps azimuth is CW. Mathematical rotation is CCW.
	// To un-rotate the point back to a straight axis-aligned grid, we rotate CCW by azimuth.
	const unrotateAngle = azimuth * (Math.PI / 180);

	const gridX = x * Math.cos(unrotateAngle) - y * Math.sin(unrotateAngle);
	const gridY = x * Math.sin(unrotateAngle) + y * Math.cos(unrotateAngle);

	// Snap to nearest integer cell
	const col = Math.round(gridX / (width + GAP_METERS));
	const row = Math.round(gridY / (length + GAP_METERS));

	const snappedGridX = col * (width + GAP_METERS);
	const snappedGridY = row * (length + GAP_METERS);

	// To re-rotate back to the world, we rotate CW by azimuth (which is mathematically -azimuth).
	const rotateAngle = -azimuth * (Math.PI / 180);
	const snappedX = snappedGridX * Math.cos(rotateAngle) - snappedGridY * Math.sin(rotateAngle);
	const snappedY = snappedGridX * Math.sin(rotateAngle) + snappedGridY * Math.cos(rotateAngle);

	return applyOffsetsInMeters(anchorLat, anchorLng, snappedX, snappedY);
}

function MapController({ onMapLoaded, onZoomChanged }: { onMapLoaded: (map: google.maps.Map) => void; onZoomChanged: (zoom: number) => void }) {
	const map = useMap();
	useEffect(() => {
		if (map) {
			onMapLoaded(map);
			onZoomChanged(map.getZoom() || 20.5);
			const listener = map.addListener('zoom_changed', () => {
				onZoomChanged(map.getZoom() || 20.5);
			});
			return () => google.maps.event.removeListener(listener);
		}
	}, [map, onMapLoaded, onZoomChanged]);
	return null;
}

export default function Solar({ client }: Props) {
	const { has } = usePermissions();
	const { debugMode: isUserDebug } = useDebug();

	const [solar, setSolar] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [calculating, setCalculating] = useState(false);
	const [error, setError] = useState('');

	const [dockNode, setDockNode] = useState<HTMLElement | null>(null);

	const [address, setAddress] = useState({
		lat: 0,
		lng: 0,
	});

	// Custom Mode State
	const [customMode, setCustomMode] = useState(false);
	const [customPanels, setCustomPanels] = useState<CustomPanel[]>([]);
	const [panelWattage, setPanelWattage] = useState(500);
	const [panelWidth, setPanelWidth] = useState(1.134);
	const [panelLength, setPanelLength] = useState(2.1);
	const [panelAzimuth, setPanelAzimuth] = useState(0);
	const [stationCode, setStationCode] = useState('');
	const [configExpanded, setConfigExpanded] = useState(false);
	const [fusionExpanded, setFusionExpanded] = useState(false);
	const [selectedPanels, setSelectedPanels] = useState<number[]>([]);
	const [clipboardPanels, setClipboardPanels] = useState<CustomPanel[]>([]);
	const [panelsToAdd, setPanelsToAdd] = useState(1);
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		lat: number;
		lng: number;
	} | null>(null);

	// Custom Map Control State
	const mapRef = useRef<google.maps.Map | null>(null);
	const [mapZoom, setMapZoom] = useState(20.5);
	const [isRightDragging, setIsRightDragging] = useState(false);
	const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
	const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
	const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
	const [marqueeCurrent, setMarqueeCurrent] = useState({ x: 0, y: 0 });
	const [debugGrid, setDebugGrid] = useState(false);

	// FusionSolar State
	const [fusionData, setFusionData] = useState<any>(null);
	const [loadingFusion, setLoadingFusion] = useState(false);
	const [fusionError, setFusionError] = useState<string | null>(null);
	const [plants, setPlants] = useState<{ value: string; label: string }[]>([]);
	const [loadingPlants, setLoadingPlants] = useState(false);
	const [plantsError, setPlantsError] = useState<any>(null);

	useEffect(() => {
		setDockNode(document.getElementById('project-dock-actions'));
	}, []);

	const isDirty = useMemo(() => {
		if (!solar) return false;

		if (customMode !== !!solar.customMode) return true;
		if (panelWattage !== (solar.panelWattage ?? 500)) return true;
		if (panelWidth !== (solar.panelWidth ?? 1.134)) return true;
		if (panelLength !== (solar.panelLength ?? 2.1)) return true;
		if (panelAzimuth !== (solar.panelAzimuth ?? 0)) return true;
		if (stationCode !== (solar.stationCode ?? '')) return true;

		const currentPanelsStr = JSON.stringify(customPanels);
		const savedPanelsStr = JSON.stringify(solar.customPanels || []);
		if (currentPanelsStr !== savedPanelsStr) return true;

		return false;
	}, [solar, customMode, panelWattage, panelWidth, panelLength, panelAzimuth, stationCode, customPanels]);

	async function loadMetadata() {
		try {
			const [data, solarData] = await Promise.all([
				fetch(`/api/projects/metadata?client=${encodeURIComponent(client)}`)
					.then((res) => res.json())
					.catch(() => null),
				fetch(`/api/projects/solar?client=${encodeURIComponent(client)}`)
					.then((res) => res.json())
					.catch(() => null),
			]);

			if (data) {
				setAddress({
					lat: data?.address?.lat ?? 0,
					lng: data?.address?.lng ?? 0,
				});
			}

			if (solarData) {
				setSolar(solarData);
				if (solarData.customPanels) setCustomPanels(solarData.customPanels);
				if (solarData.panelWattage) setPanelWattage(solarData.panelWattage);
				if (solarData.panelWidth) setPanelWidth(solarData.panelWidth);
				if (solarData.panelLength) setPanelLength(solarData.panelLength);
				if (solarData.stationCode) setStationCode(solarData.stationCode);
				if (solarData.customMode) setCustomMode(solarData.customMode);
			} else if (data?.solar) {
				setSolar(data.solar);
			}
		} finally {
			setLoading(false);
		}
	}

	async function saveSolarData(newData: any) {
		setCalculating(true);
		try {
			await fetch('/api/projects/solar', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					client,
					data: newData,
				}),
			});
			setSolar(newData);
		} catch (error) {
			console.error(error);
		} finally {
			setCalculating(false);
		}
	}

	async function saveCustomizations() {
		if (!solar) return;
		const newData = {
			...solar,
			customMode,
			customPanels,
			panelWattage,
			panelWidth,
			panelLength,
			panelAzimuth,
			stationCode,
		};
		await saveSolarData(newData);
	}

	useEffect(() => {
		// Only fetch if it looks like a valid station code to save API calls while typing
		const isValidFormat = stationCode.startsWith('NE=') && /^\d+$/.test(stationCode.slice(3));

		if (stationCode && isValidFormat) {
			fetchFusionData();
			const interval = setInterval(fetchFusionData, 300000); // Poll every 5 minutes
			return () => clearInterval(interval);
		}
	}, [stationCode]);

	// Keyboard shortcuts (Ctrl+C, Ctrl+V, Delete)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!customMode) return;
			// Ignore if typing in an input
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
				if (selectedPanels.length > 0) {
					const copied = selectedPanels.map((idx) => customPanels[idx]).filter(Boolean);
					setClipboardPanels(copied);
				}
			}
			if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
				if (clipboardPanels.length > 0) {
					// Paste them slightly offset so they don't exactly overlap
					const pasted = clipboardPanels.map((p) => ({
						...p,
						lat: p.lat - 0.000015,
						lng: p.lng + 0.000015,
					}));
					setCustomPanels((prev) => {
						const newPanels = [...prev, ...pasted];
						// Select the newly pasted panels
						const newIndices = pasted.map((_, i) => prev.length + i);
						setSelectedPanels(newIndices);
						return newPanels;
					});
				}
			}
			if (e.key === 'Delete' || e.key === 'Backspace') {
				if (selectedPanels.length > 0) {
					setCustomPanels((prev) => prev.filter((_, i) => !selectedPanels.includes(i)));
					setSelectedPanels([]);
					setContextMenu(null);
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [customMode, selectedPanels, customPanels, clipboardPanels]);

	async function fetchFusionData() {
		setLoadingFusion(true);
		setFusionError(null);
		try {
			const res = await fetch('/api/projects/fusionsolar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ stationCode }),
			});
			const data = await res.json();
			if (data.success) {
				// The API now returns the first object directly rather than an array
				setFusionData(Array.isArray(data.data) ? data.data[0] : data.data);
			} else {
				setFusionError(JSON.stringify(data, null, 2));
			}
		} catch (e: any) {
			console.error(e);
			setFusionError(JSON.stringify({ error: e.message || String(e) }, null, 2));
		} finally {
			setLoadingFusion(false);
		}
	}

	async function fetchPlants() {
		setLoadingPlants(true);
		setPlantsError(null);
		try {
			const res = await fetch('/api/projects/fusionsolar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'list' }),
			});
			const data = await res.json();
			if (data.success && data.data) {
				setPlants(
					data.data.map((p: any) => ({
						value: p.stationCode,
						label: p.stationName || p.plantName || p.stationCode || 'Unnamed Station',
					}))
				);
			} else {
				setPlantsError(data);
			}
		} catch (e) {
			console.error(e);
			setPlantsError(e);
		} finally {
			setLoadingPlants(false);
		}
	}

	useEffect(() => {
		if (fusionExpanded && plants.length === 0) {
			fetchPlants();
		}
	}, [fusionExpanded]);

	async function analyzeRoof() {
		try {
			setCalculating(true);
			const data = await fetch('/api/projects/solar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lat: address.lat, lng: address.lng }),
			})
				.then((res) => res.json())
				.catch(() => ({ error: 'Failed to analyze' }));

			if (data.error) {
				const fallbackData = {
					customMode: true,
					customPanels: [],
					panelWattage,
					panelWidth,
					panelLength,
					panelAzimuth,
					stationCode,
				};
				await saveSolarData(fallbackData);
				setError('Google Solar API could not analyze this roof. Defaulting to custom layout mode.');
				return;
			}

			const newData = {
				...data,
				customMode,
				customPanels,
				panelWattage,
				panelWidth,
				panelLength,
				panelAzimuth,
				stationCode,
			};
			await saveSolarData(newData);
			setError('');
			setConfigExpanded(true);
		} catch (error) {
			console.error(error);
		} finally {
			setCalculating(false);
		}
	}

	async function deleteAnalysis() {
		if (!confirm('Are you sure you want to delete the solar analysis?')) return;
		try {
			setCalculating(true);
			await fetch(`/api/projects/solar?client=${encodeURIComponent(client)}`, {
				method: 'DELETE',
			});
			setSolar(null);
		} catch (error) {
			console.error(error);
			setError('Failed to delete solar data');
		} finally {
			setCalculating(false);
		}
	}

	useEffect(() => {
		loadMetadata();
	}, [client]);

	const configs = solar?.configs ?? [];
	const [selectedConfigIndex, setSelectedConfigIndex] = useState(0);

	useEffect(() => {
		if (!solar?.recommended) return;
		const index = configs.findIndex((x: any) => x?.panelsCount === solar.recommended?.panelsCount);
		if (index >= 0) setSelectedConfigIndex(index);
	}, [solar]);

	const selectedConfig = configs[selectedConfigIndex] ?? solar?.recommended;

	function getDirection(azimuth: number) {
		if (azimuth >= 337.5 || azimuth < 22.5) return 'North';
		if (azimuth < 67.5) return 'North-East';
		if (azimuth < 112.5) return 'East';
		if (azimuth < 157.5) return 'South-East';
		if (azimuth < 202.5) return 'South';
		if (azimuth < 247.5) return 'South-West';
		if (azimuth < 292.5) return 'West';
		return 'North-West';
	}

	const recommendedPanels =
		solar?.solarPanels?.filter((panel: any) => {
			const summary = selectedConfig?.roofSegmentSummaries?.find((x: any) => x.segmentIndex === panel.segmentIndex);
			if (!summary) return false;
			const panelsInSegment = solar.solarPanels.filter((p: any) => p.segmentIndex === panel.segmentIndex);
			const indexInSegment = panelsInSegment.indexOf(panel);
			return indexInSegment < summary?.panelsCount;
		}) ?? [];

	function enableCustomMode() {
		if (customPanels.length === 0 && recommendedPanels.length > 0) {
			setCustomPanels(
				recommendedPanels.map((p: any) => ({
					lat: p.center.latitude,
					lng: p.center.longitude,
					azimuth: selectedConfig?.roofSegmentSummaries?.find((x: any) => x.segmentIndex === p.segmentIndex)?.azimuthDegrees ?? 0,
				}))
			);
		}
		setCustomMode(true);
	}

	const isForcedCustom = !solar?.solarPanels?.length;
	const isCustomActive = customMode || isForcedCustom;
	const visiblePanels = isCustomActive ? customPanels : recommendedPanels;

	const hasAnalysis = Boolean(solar);

	// Generate debug grid markers
	const debugGridMarkers = useMemo(() => {
		const markers = [];
		if (debugGrid && customPanels.length > 0) {
			const anchor = customPanels[0];
			const theta = anchor.azimuth * (Math.PI / 180);
			// 20x20 grid around the anchor panel
			for (let r = -10; r <= 10; r++) {
				for (let c = -10; c <= 10; c++) {
					const gridX = c * panelWidth;
					const gridY = r * panelLength;

					// Rotate grid offsets back to map world offsets (matching snapToGrid's re-rotate)
					const rotateAngle = -anchor.azimuth * (Math.PI / 180);
					const snappedX = gridX * Math.cos(rotateAngle) - gridY * Math.sin(rotateAngle);
					const snappedY = gridX * Math.sin(rotateAngle) + gridY * Math.cos(rotateAngle);

					const pos = applyOffsetsInMeters(anchor.lat, anchor.lng, snappedX, snappedY);
					markers.push({ ...pos, azimuth: anchor.azimuth });
				}
			}
		}
		return markers;
	}, [debugGrid, customPanels, panelWidth, panelLength]);

	if (loading) return <Loading title="Loading Solar Analyzer" description="Checking for existing solar configuration." />;

	// Scale visually exactly based on zoom level.
	// At zoom 20.5, a multiplier of ~14.8 perfectly sizes a 1m panel to touch without overlapping its border.
	const scale = Math.pow(2, mapZoom - 20.5);
	const pxWidth = panelWidth * 14.8 * scale;
	const pxLength = panelLength * 14.8 * scale;

	// Calculate custom layout specs
	const totalCustomWattage = visiblePanels.length * panelWattage;

	let estimatedYield = 0;
	if (customMode && solar?.recommended) {
		const yieldPerPanel = solar.recommended.yearlyEnergyDcKwh / solar.recommended.panelsCount;
		estimatedYield = visiblePanels.length * yieldPerPanel;
	}

	// Calculate realistic CSS cell grid for solar panels (using typical ~18cm cells)
	const cellCols = Math.max(1, Math.round(panelWidth / 0.18));
	const cellRows = Math.max(1, Math.round(panelLength / 0.18));
	const panelBgSize = `100% 100%, ${100 / cellCols}% 100%, 100% ${100 / cellRows}%`;

	return (
		<div
			className="flex flex-col gap-6 relative"
			onClick={() => {
				setContextMenu(null);
				setSelectedPanels([]);
			}}
		>
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-semibold tracking-tight">Solar Analysis</h2>
					<div className="text-sm text-(--text-muted)">
						{address.lat.toFixed(6)}, {address.lng.toFixed(6)}
						{solar?.maxSunshineHoursPerYear && (
							<>
								{' • '}
								{Math.round(solar.maxSunshineHoursPerYear).toLocaleString()} sun hours/year
							</>
						)}
					</div>
				</div>
			</div>

			{dockNode &&
				createPortal(
					<>
						{has('projects.write') && (
							<Button loading={calculating} onClick={saveCustomizations} variant={isDirty ? 'primary' : 'secondary'} disabled={!isDirty} className="hidden sm:flex transition-all">
								<Save size={16} />
								{isDirty ? 'Save Changes' : 'Saved'}
							</Button>
						)}
						{has('projects.write') && (
							<Button loading={calculating} disabled={hasAnalysis && isCustomActive} onClick={analyzeRoof} className="hidden sm:flex">
								<Sun size={16} />
								{hasAnalysis ? 'Re-analyze Roof' : 'Analyze Roof'}
							</Button>
						)}
						{hasAnalysis && has('projects.write') && (
							<Button variant="danger" loading={calculating} onClick={deleteAnalysis} className="hidden sm:flex" icon={<Trash2 size={16} />}>
								<span className="hidden sm:inline">Delete Setup</span>
							</Button>
						)}
					</>,
					dockNode
				)}

			{!hasAnalysis && (
				<EmptyState
					icon={<Sun size={48} />}
					title="No Solar Analysis Available"
					description={error || 'Run a roof analysis to calculate possible panel layouts, yearly production estimates and optimal panel placement.'}
				/>
			)}

			{hasAnalysis && (
				<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
					<div className="xl:col-span-2 space-y-6">
						<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
							<MapController onMapLoaded={(m) => (mapRef.current = m)} onZoomChanged={setMapZoom} />

							{isMarqueeSelecting && (
								<div
									style={{
										position: 'fixed',
										left: Math.min(marqueeStart.x, marqueeCurrent.x),
										top: Math.min(marqueeStart.y, marqueeCurrent.y),
										width: Math.abs(marqueeStart.x - marqueeCurrent.x),
										height: Math.abs(marqueeStart.y - marqueeCurrent.y),
										backgroundColor: 'rgba(59, 130, 246, 0.2)',
										border: '1px solid rgba(59, 130, 246, 0.5)',
										pointerEvents: 'none',
										zIndex: 9999,
									}}
								/>
							)}

							<motion.div
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.25 }}
								className="rounded-3xl overflow-hidden bg-(--foreground) relative"
								onMouseDownCapture={(e) => {
									if (!isCustomActive) return;

									// If they clicked on a panel or control, ignore
									if ((e.target as HTMLElement).closest('.solar-panel-marker')) return;
									if ((e.target as HTMLElement).closest('.map-controls')) return;

									// Right click -> start pan
									if (e.button === 2) {
										e.stopPropagation(); // stop default google map right click behavior
										e.preventDefault();
										setIsRightDragging(true);
										setLastMousePos({ x: e.clientX, y: e.clientY });
									}
									// Left click -> start marquee
									else if (e.button === 0) {
										e.stopPropagation(); // stop google maps from panning!
										setIsMarqueeSelecting(true);
										setMarqueeStart({ x: e.clientX, y: e.clientY });
										setMarqueeCurrent({ x: e.clientX, y: e.clientY });
									}
								}}
								onMouseMoveCapture={(e) => {
									if (isRightDragging && mapRef.current) {
										e.stopPropagation();
										e.preventDefault();
										const dx = lastMousePos.x - e.clientX;
										const dy = lastMousePos.y - e.clientY;
										mapRef.current.panBy(dx, dy);
										setLastMousePos({ x: e.clientX, y: e.clientY });
									}
									if (isMarqueeSelecting) {
										e.stopPropagation();
										e.preventDefault();
										setMarqueeCurrent({ x: e.clientX, y: e.clientY });
									}
								}}
								onMouseUpCapture={(e) => {
									if (isRightDragging) {
										setIsRightDragging(false);
									}
									if (isMarqueeSelecting) {
										setIsMarqueeSelecting(false);

										const left = Math.min(marqueeStart.x, marqueeCurrent.x);
										const right = Math.max(marqueeStart.x, marqueeCurrent.x);
										const top = Math.min(marqueeStart.y, marqueeCurrent.y);
										const bottom = Math.max(marqueeStart.y, marqueeCurrent.y);

										const panelsElements = document.querySelectorAll('.solar-panel-marker');
										const newSelected: number[] = [];

										panelsElements.forEach((el) => {
											const rect = el.getBoundingClientRect();
											if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
												const idxStr = el.getAttribute('data-index');
												if (idxStr) newSelected.push(Number(idxStr));
											}
										});

										if (e.shiftKey || e.ctrlKey || e.metaKey) {
											setSelectedPanels((prev) => Array.from(new Set([...prev, ...newSelected])));
										} else {
											setSelectedPanels(newSelected);
										}
									}
								}}
								onContextMenuCapture={(e) => {
									if (isCustomActive) {
										e.preventDefault(); // stop browser context menu
									}
								}}
							>
								<Map
									mapId={'map'}
									defaultCenter={address}
									defaultZoom={20.5}
									mapTypeId="satellite"
									disableDefaultUI={true}
									gestureHandling="greedy"
									style={{ width: '100%', height: '600px' }}
									onContextmenu={(e: MapMouseEvent) => {
										// Right click to map is handled by DOM capture now for panning.
										// We still keep this to stop propagation.
										if (isCustomActive && e.detail.latLng) {
											const mouseEvent = e.domEvent as MouseEvent;
											mouseEvent.preventDefault();
										}
									}}
									onDblclick={(e: MapMouseEvent) => {
										// Double left click to add a panel!
										if (isCustomActive && e.detail.latLng) {
											const newPanels = [
												...customPanels,
												{
													lat: e.detail.latLng.lat,
													lng: e.detail.latLng.lng,
													azimuth: panelAzimuth,
												},
											];
											setCustomPanels(newPanels);
											setSelectedPanels([newPanels.length - 1]);
										}
									}}
								>
									{debugGridMarkers.map((pos, index) => (
										<AdvancedMarker key={`debug-${index}`} position={{ lat: pos.lat, lng: pos.lng }}>
											<div
												style={{
													width: pxWidth,
													height: pxLength,
													transform: `rotate(${pos.azimuth}deg)`,
												}}
												className="border-[1px] border-red-500/50 pointer-events-none"
											/>
										</AdvancedMarker>
									))}

									{visiblePanels.map((panel: any, index: number) => {
										const azimuth = isCustomActive
											? panel.azimuth
											: (selectedConfig?.roofSegmentSummaries?.find((x: any) => x.segmentIndex === panel.segmentIndex)?.azimuthDegrees ?? 0);
										const lat = isCustomActive ? panel.lat : panel.center.latitude;
										const lng = isCustomActive ? panel.lng : panel.center.longitude;
										const isSelected = selectedPanels.includes(index);

										return (
											<AdvancedMarker
												key={index}
												position={{ lat, lng }}
												draggable={isCustomActive}
												onDragEnd={(e) => {
													if (!isCustomActive || !e.latLng) return;

													let lat = e.latLng.lat();
													let lng = e.latLng.lng();
													let newAzimuth = azimuth;

													// Magnetic Snap: find nearest panel
													let minDistance = Infinity;
													let nearestAnchorIndex = -1;

													customPanels.forEach((p, i) => {
														if (i === index) return;
														const offsets = getOffsetsInMeters(p.lat, p.lng, lat, lng);
														const dist = Math.sqrt(offsets.x * offsets.x + offsets.y * offsets.y);
														if (dist < minDistance) {
															minDistance = dist;
															nearestAnchorIndex = i;
														}
													});

													// Snap if within 5 meters
													if (nearestAnchorIndex !== -1 && minDistance < 5) {
														const anchor = customPanels[nearestAnchorIndex];
														const snapped = snapToGrid(lat, lng, anchor.lat, anchor.lng, anchor.azimuth, panelWidth, panelLength);
														lat = snapped.lat;
														lng = snapped.lng;
														newAzimuth = anchor.azimuth;
													}

													const panels = [...customPanels];
													panels[index].lat = lat;
													panels[index].lng = lng;
													panels[index].azimuth = newAzimuth;
													setCustomPanels(panels);
												}}
											>
												<div
													data-index={index}
													className={`solar-panel-marker rounded-[2px] cursor-pointer transition-all pointer-events-auto ${isSelected ? 'ring-2 ring-yellow-400 z-10 scale-110 shadow-lg shadow-yellow-400/50' : 'ring-1 ring-slate-400/70 hover:ring-slate-200 shadow-sm'}`}
													style={{
														width: pxWidth,
														height: pxLength,
														transform: `rotate(${azimuth}deg)`,
														backgroundColor: '#0a192f',
														backgroundImage: `
															linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%),
															linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px),
															linear-gradient(0deg, rgba(255,255,255,0.15) 1px, transparent 1px)
														`,
														backgroundSize: panelBgSize,
													}}
													onContextMenu={(e: ReactMouseEvent) => {
														if (isCustomActive) {
															e.preventDefault();
															e.stopPropagation();
															if (!selectedPanels.includes(index)) {
																setSelectedPanels([index]);
															}
															setContextMenu({
																x: e.clientX,
																y: e.clientY,
																lat,
																lng,
															});
														}
													}}
													onClick={(e: ReactMouseEvent) => {
														if (isCustomActive) {
															e.preventDefault();
															e.stopPropagation();

															const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
															let newSelected = [...selectedPanels];
															if (isMulti) {
																if (newSelected.includes(index)) {
																	newSelected = newSelected.filter((i) => i !== index);
																} else {
																	newSelected.push(index);
																}
															} else {
																newSelected = [index];
															}
															setSelectedPanels(newSelected);

															if (newSelected.length > 0) {
																setContextMenu({
																	x: e.clientX,
																	y: e.clientY,
																	lat,
																	lng,
																});
															} else {
																setContextMenu(null);
															}
														}
													}}
												/>
											</AdvancedMarker>
										);
									})}
								</Map>
							</motion.div>
						</APIProvider>

						{stationCode && (
							<div className="mt-6 rounded-2xl p-6 bg-(--foreground) shadow-sm">
								<div className="flex items-center gap-2 mb-6 text-(--text-muted)">
									<Activity size={18} />
									<span className="font-medium">Live System Yield (FusionSolar)</span>

									<AnimatePresence>
										{loadingFusion && (
											<motion.div
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												exit={{ opacity: 0, scale: 0.8 }}
												className="ml-auto text-(--text-muted)"
											>
												<Loader2 size={16} className="animate-spin" />
											</motion.div>
										)}
									</AnimatePresence>
								</div>
								{!fusionData && loadingFusion ? (
									<div className="flex items-center gap-2 text-sm text-(--text-muted)">
										<Loader2 size={14} className="animate-spin" />
										Fetching live data from Huawei FusionSolar...
									</div>
								) : fusionData ? (
									<>
										<div className="grid grid-cols-2 md:grid-cols-4 gap-6 gap-y-8">
											<div>
												<div className="text-3xl font-bold text-green-500">{Number(fusionData.dataItemMap?.active_power || 0).toLocaleString()}</div>
												<div className="text-sm text-(--text-muted) mt-1">Current (kW)</div>
											</div>
											<div>
												<div className="text-3xl font-bold">{Number(fusionData.dataItemMap?.day_power || 0).toLocaleString()}</div>
												<div className="text-sm text-(--text-muted) mt-1">Today (kWh)</div>
											</div>
											<div>
												<div className="text-3xl font-bold">{Number(fusionData.dataItemMap?.month_power || 0).toLocaleString()}</div>
												<div className="text-sm text-(--text-muted) mt-1">This Month (kWh)</div>
											</div>
											<div>
												<div className="text-3xl font-bold">{Number(fusionData.dataItemMap?.total_power || 0).toLocaleString()}</div>
												<div className="text-sm text-(--text-muted) mt-1">Lifetime (kWh)</div>
											</div>
											<div>
												<div className="text-3xl font-bold">€{Number(fusionData.dataItemMap?.day_income || 0).toLocaleString()}</div>
												<div className="text-sm text-(--text-muted) mt-1">Revenue Today</div>
											</div>
											<div>
												<div className="text-3xl font-bold">€{Number(fusionData.dataItemMap?.total_income || 0).toLocaleString()}</div>
												<div className="text-sm text-(--text-muted) mt-1">Total Revenue</div>
											</div>
											<div>
												<div
													className={`text-3xl font-bold ${Number(fusionData.dataItemMap?.real_health_state || 0) === 3 ? 'text-green-500' : Number(fusionData.dataItemMap?.real_health_state || 0) === 2 ? 'text-red-500' : Number(fusionData.dataItemMap?.real_health_state || 0) === 1 ? 'text-orange-500' : 'text-(--text-muted)'}`}
												>
													{Number(fusionData.dataItemMap?.real_health_state || 0) === 3
														? 'Healthy'
														: Number(fusionData.dataItemMap?.real_health_state || 0) === 2
															? 'Faulty'
															: Number(fusionData.dataItemMap?.real_health_state || 0) === 1
																? 'Disconnected'
																: 'Unknown'}
												</div>
												<div className="text-sm text-(--text-muted) mt-1">System Status</div>
											</div>
										</div>

										{isUserDebug && (
											<div className="mt-8 p-4 bg-black/5 rounded-lg border border-(--border)/20 text-xs font-mono text-(--text-muted) overflow-x-auto">
												<div className="font-bold mb-3 text-orange-500">DEBUG - Huawei Raw dataItemMap Keys:</div>
												<div className="grid grid-cols-2 gap-2">
													{Object.keys(fusionData.dataItemMap || {}).map((key) => (
														<div key={key} className="flex gap-2">
															<span className="font-semibold text-(--foreground)">{key}:</span>
															<span>{fusionData.dataItemMap[key]}</span>
														</div>
													))}
												</div>
											</div>
										)}
									</>
								) : (
									<div className="text-sm text-red-500/80">
										{isUserDebug && fusionError ? (
											<div className="font-mono bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-xs">
												<strong className="block mb-2">RAW JSON API RESPONSE:</strong>
												<pre className="whitespace-pre-wrap">{fusionError}</pre>
											</div>
										) : (
											"We couldn't reach the Huawei FusionSolar servers right now. They might be undergoing maintenance, or the connection timed out. Please try again later."
										)}
									</div>
								)}
							</div>
						)}
					</div>

					<div className="space-y-6">
						<div className="rounded-3xl bg-(--foreground) overflow-hidden">
							<div
								className="flex items-center justify-between p-6 cursor-pointer select-none hover:bg-(--border)/5 transition-colors"
								onClick={() => setConfigExpanded(!configExpanded)}
							>
								<h3 className="font-semibold flex items-center gap-2">
									<Settings size={18} /> Layout Configuration
								</h3>
								<ChevronDown size={18} className={`transition-transform duration-200 ${configExpanded ? 'rotate-180' : ''}`} />
							</div>

							<AnimatePresence initial={false}>
								{configExpanded && (
									<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
										<div className="p-6 pt-0">
											<div className="mb-6 pb-6 border-b border-(--border)/20">
												<Toggle
													checked={isCustomActive}
													disabled={isForcedCustom}
													onChange={(checked) => {
														if (checked) enableCustomMode();
														else setCustomMode(false);
													}}
													label="Custom Mode"
													description={isForcedCustom ? 'Google API missing roof data. Forced custom mode.' : 'Manually place and configure panels'}
												/>
											</div>

											{isUserDebug && (
												<div className="mb-6 pb-6 border-b border-(--border)/20">
													<Toggle
														checked={debugGrid}
														onChange={(checked) => setDebugGrid(checked)}
														label="Debug Grid Mode"
														description="Visualize the mathematical grid around the first panel"
													/>
												</div>
											)}

											{!isCustomActive && solar?.configs?.length > 0 && (
												<div className="space-y-4">
													<p className="text-sm text-(--text-muted) mb-2">Google Solar API Recommended Configuration:</p>
													<input
														type="range"
														min={0}
														max={Math.max(configs.length - 1, 0)}
														step={1}
														value={selectedConfigIndex}
														onChange={(e) => setSelectedConfigIndex(Number(e.target.value))}
														className="solar-slider w-full"
													/>
													<div className="flex justify-between text-xs text-(--text-muted)">
														<span>{configs[0]?.panelsCount ?? 0} panels</span>
														<span>{configs.at(-1)?.panelsCount ?? 0} panels</span>
													</div>
												</div>
											)}

											{isCustomActive && (
												<div className="space-y-4">
													<p className="text-sm text-(--text-muted) mb-4">Right-click on the map to add panels. Right-click on a panel to delete or rotate.</p>
													<div className="grid grid-cols-2 gap-3">
														<div>
															<label className="text-xs text-(--text-muted) block mb-1">Wattage (W)</label>
															<input
																type="number"
																value={panelWattage}
																onChange={(e) => setPanelWattage(Number(e.target.value))}
																className="w-full bg-(--background) rounded-lg px-3 py-2 text-sm border border-(--border)/20 focus:border-(--accent) outline-none"
															/>
														</div>
														<div>
															<label className="text-xs text-(--text-muted) block mb-1">Length (m)</label>
															<input
																type="number"
																step="0.01"
																value={panelLength}
																onChange={(e) => setPanelLength(Number(e.target.value))}
																className="w-full bg-(--background) rounded-lg px-3 py-2 text-sm border border-(--border)/20 focus:border-(--accent) outline-none"
															/>
														</div>
														<div>
															<label className="text-xs text-(--text-muted) block mb-1">Width (m)</label>
															<input
																type="number"
																step="0.01"
																value={panelWidth}
																onChange={(e) => setPanelWidth(Number(e.target.value))}
																className="w-full bg-(--background) rounded-lg px-3 py-2 text-sm border border-(--border)/20 focus:border-(--accent) outline-none"
															/>
														</div>
														<div>
															<label className="text-xs text-(--text-muted) block mb-1">Orientation (°)</label>
															<input
																type="number"
																step="1"
																value={panelAzimuth}
																onChange={(e) => {
																	const val = Number(e.target.value);
																	setPanelAzimuth(val);
																	setCustomPanels(
																		customPanels.map((p) => ({
																			...p,
																			azimuth: val,
																		}))
																	);
																}}
																className="w-full bg-(--background) rounded-lg px-3 py-2 text-sm border border-(--border)/20 focus:border-(--accent) outline-none"
															/>
														</div>
													</div>

													<div className="pt-4 mt-2 border-t border-(--border)/20">
														<label className="text-xs text-(--text-muted) block mb-1">Add Panels</label>
														<div className="flex gap-2">
															<input
																type="number"
																min={1}
																max={100}
																value={panelsToAdd}
																onChange={(e) => setPanelsToAdd(Number(e.target.value))}
																className="w-20 bg-(--background) rounded-lg px-3 py-2 text-sm border border-(--border)/20 focus:border-(--accent) outline-none"
															/>
															<Button
																className="flex-1"
																onClick={() => {
																	// Determine center to place them
																	const centerLat = customPanels.length > 0 ? customPanels[customPanels.length - 1].lat : address.lat;
																	const centerLng = customPanels.length > 0 ? customPanels[customPanels.length - 1].lng : address.lng;

																	const newPanels = Array.from({
																		length: panelsToAdd,
																	}).map((_, i) => ({
																		lat: centerLat - (i + 1) * 0.00001,
																		lng: centerLng + (i + 1) * 0.00001,
																		azimuth: panelAzimuth,
																	}));

																	const newCustomPanels = [...customPanels, ...newPanels];
																	setCustomPanels(newCustomPanels);

																	const startIdx = customPanels.length;
																	setSelectedPanels(newPanels.map((_, i) => startIdx + i));
																}}
															>
																Add to Map
															</Button>
														</div>
													</div>
												</div>
											)}

											<div className="mt-6 rounded-2xl p-5 bg-(--accent)/10 border border-(--accent)/30">
												<div className="flex items-center gap-2 mb-4">
													<Zap size={18} className="text-(--accent)" />
													<span className="font-medium">{isCustomActive ? 'Custom System Yield' : 'Selected System Yield'}</span>
												</div>
												<div className="grid grid-cols-2 gap-4">
													<div>
														<div className="text-3xl font-bold">{visiblePanels.length}</div>
														<div className="text-xs text-(--text-muted)">Total Panels</div>
													</div>
													<div>
														<div className="text-lg font-bold">{Math.round(isCustomActive ? estimatedYield : selectedConfig?.yearlyEnergyDcKwh).toLocaleString()} kWh</div>
														<div className="text-xs text-(--text-muted)">
															≈ {customMode ? (totalCustomWattage / 1000).toFixed(2) : ((selectedConfig?.panelsCount * 440) / 1000).toFixed(1)} kWp
														</div>
													</div>
												</div>
											</div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>

						<div className="rounded-3xl bg-(--foreground) overflow-hidden">
							<div
								className="flex items-center justify-between p-6 cursor-pointer select-none hover:bg-(--border)/5 transition-colors"
								onClick={() => setFusionExpanded(!fusionExpanded)}
							>
								<h3 className="font-semibold flex items-center gap-2">
									<Activity size={18} /> FusionSolar Integration
								</h3>
								<ChevronDown size={18} className={`transition-transform duration-200 ${fusionExpanded ? 'rotate-180' : ''}`} />
							</div>

							<AnimatePresence initial={false}>
								{fusionExpanded && (
									<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
										<div className="p-6 pt-0 space-y-4">
											<div>
												<label className="text-xs text-(--text-muted) block mb-1">Select Plant</label>
												<div className="flex gap-2 items-center">
													<div className="flex-1">
														<Selector
															loading={loadingPlants}
															disabled={loadingPlants}
															options={plants}
															value={stationCode}
															onChange={setStationCode}
															placeholder="Select a FusionSolar Plant"
														/>
													</div>
													<Button
														onClick={() => {
															saveCustomizations();
															setFusionExpanded(true);
														}}
														disabled={!stationCode}
														loading={calculating}
													>
														Link
													</Button>
												</div>
												{plantsError && isUserDebug && (
													<div className="mt-2 text-xs text-red-500 bg-red-500/10 p-2 rounded whitespace-pre-wrap font-mono">{JSON.stringify(plantsError, null, 2)}</div>
												)}
												{isUserDebug && (
													<div className="mt-3 flex flex-col gap-1">
														<label className="text-xs text-(--text-muted) font-mono">DEBUG: Override Station Code</label>
														<input
															type="text"
															value={stationCode}
															onChange={(e) => setStationCode(e.target.value)}
															placeholder="e.g. NE=..."
															className="bg-(--background) border border-(--border)/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-(--accent)"
														/>
													</div>
												)}
											</div>

											{stationCode && !fusionData && loadingFusion && (
												<div className="flex items-center gap-2 text-sm text-(--text-muted) py-4">
													<Loader2 size={14} className="animate-spin" />
													Fetching live data...
												</div>
											)}

											{stationCode && fusionData && (
												<div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-(--border)/20">
													<div>
														<div className="text-xs text-(--text-muted)">Current Power</div>
														<div className="text-lg font-semibold text-green-500">{Number(fusionData.dataItemMap?.active_power || 0).toLocaleString()} kW</div>
													</div>
													<div>
														<div className="text-xs text-(--text-muted)">Daily Yield</div>
														<div className="text-lg font-semibold">{Number(fusionData.dataItemMap?.day_power || 0).toLocaleString()} kWh</div>
													</div>
													<div>
														<div className="text-xs text-(--text-muted)">Monthly Yield</div>
														<div className="text-lg font-semibold">{Number(fusionData.dataItemMap?.month_power || 0).toLocaleString()} kWh</div>
													</div>
													<div>
														<div className="text-xs text-(--text-muted)">Lifetime Yield</div>
														<div className="text-lg font-semibold">{Number(fusionData.dataItemMap?.total_power || 0).toLocaleString()} kWh</div>
													</div>
													<div>
														<div className="text-xs text-(--text-muted)">System Status</div>
														<div
															className={`text-lg font-semibold ${Number(fusionData.dataItemMap?.real_health_state || 0) === 3 ? 'text-green-500' : Number(fusionData.dataItemMap?.real_health_state || 0) === 2 ? 'text-red-500' : Number(fusionData.dataItemMap?.real_health_state || 0) === 1 ? 'text-orange-500' : 'text-(--text-muted)'}`}
														>
															{Number(fusionData.dataItemMap?.real_health_state || 0) === 3
																? 'Healthy'
																: Number(fusionData.dataItemMap?.real_health_state || 0) === 2
																	? 'Faulty'
																	: Number(fusionData.dataItemMap?.real_health_state || 0) === 1
																		? 'Disconnected'
																		: 'Unknown'}
														</div>
													</div>
												</div>
											)}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</div>
				</div>
			)}

			<AnimatePresence>
				{contextMenu && (
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						transition={{ duration: 0.1 }}
						className="fixed z-50 bg-(--foreground) rounded-xl shadow-xl border border-(--border)/20 p-1 flex flex-col min-w-[150px]"
						style={{ left: contextMenu.x, top: contextMenu.y }}
						onClick={(e) => e.stopPropagation()}
					>
						{selectedPanels.length > 0 ? (
							<>
								<div className="px-4 py-2 border-b border-(--border)/20 mb-1">
									<div className="text-xs font-semibold mb-2 text-(--accent)">
										{selectedPanels.length} Panel
										{selectedPanels.length > 1 ? 's' : ''} Selected
									</div>
									<label className="text-xs text-(--text-muted) block mb-1">Orientation (°)</label>
									<input
										type="number"
										className="w-full bg-(--background) rounded-md px-2 py-1 text-sm border border-(--border)/20 outline-none"
										value={customPanels[selectedPanels[0]]?.azimuth || 0}
										onChange={(e) => {
											const val = Number(e.target.value);
											const panels = [...customPanels];
											selectedPanels.forEach((idx) => {
												if (panels[idx]) panels[idx].azimuth = val;
											});
											setCustomPanels(panels);
										}}
									/>
								</div>
								<button
									className="px-4 py-2 text-sm text-left hover:bg-(--background) rounded-lg flex items-center gap-2"
									onClick={() => {
										const panels = [...customPanels];
										selectedPanels.forEach((idx) => {
											if (panels[idx]) panels[idx].azimuth += 90;
										});
										setCustomPanels(panels);
									}}
								>
									<RotateCcw size={14} /> Rotate 90°
								</button>
								<button
									className="px-4 py-2 text-sm text-left hover:bg-(--background) rounded-lg flex items-center gap-2"
									onClick={() => {
										const panels = [...customPanels];
										const anchorIdx = selectedPanels[0];
										const anchor = panels[anchorIdx];

										selectedPanels.forEach((idx) => {
											if (idx === anchorIdx || !panels[idx]) return;
											const p = panels[idx];
											const snapped = snapToGrid(p.lat, p.lng, anchor.lat, anchor.lng, anchor.azimuth, panelWidth, panelLength);
											p.lat = snapped.lat;
											p.lng = snapped.lng;
											p.azimuth = anchor.azimuth;
										});

										setCustomPanels(panels);
									}}
								>
									<Grid size={14} /> Snap to Array Grid
								</button>
								<button
									className="px-4 py-2 text-sm text-left hover:bg-(--background) rounded-lg flex items-center gap-2"
									onClick={() => {
										const panels = [...customPanels];
										const anchorIdx = selectedPanels[0];
										const anchor = panels[anchorIdx];

										selectedPanels.forEach((idx) => {
											if (idx === anchorIdx || !panels[idx]) return;
											const p = panels[idx];
											const snapped = snapToGrid(p.lat, p.lng, anchor.lat, anchor.lng, anchor.azimuth, panelWidth, panelLength);
											p.lat = snapped.lat;
											p.lng = snapped.lng;
											p.azimuth = anchor.azimuth;
										});

										setCustomPanels(panels);
									}}
								>
									<Grid size={14} /> Snap to Array Grid
								</button>
								<button
									className="px-4 py-2 text-sm text-left hover:bg-(--background) rounded-lg flex items-center gap-2 text-red-500"
									onClick={() => {
										setCustomPanels(customPanels.filter((_, i) => !selectedPanels.includes(i)));
										setSelectedPanels([]);
										setContextMenu(null);
									}}
								>
									<Trash2 size={14} /> Delete Selected
								</button>
							</>
						) : (
							<button
								className="px-4 py-2 text-sm text-left hover:bg-(--background) rounded-lg flex items-center gap-2"
								onClick={() => {
									setCustomPanels([
										...customPanels,
										{
											lat: contextMenu.lat,
											lng: contextMenu.lng,
											azimuth: panelAzimuth,
										},
									]);
									setContextMenu(null);
								}}
							>
								<Sun size={14} /> Add Panel Here
							</button>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
