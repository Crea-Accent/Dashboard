/** @format */
'use client';

import { APIProvider, AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import { PanelTop, Sun, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import EmptyState from '../ui/EmptyState';
import Loading from '../ui/Loading';
import { motion } from 'framer-motion';
import { usePermissions } from '@/providers/PermissionsProvider';

type Props = {
	client: string;
};

export default function Solar({ client }: Props) {
	const { has } = usePermissions();

	const [solar, setSolar] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [calculating, setCalculating] = useState(false);
	const [error, setError] = useState('');

	const [address, setAddress] = useState({
		lat: 0,
		lng: 0,
	});

	async function loadMetadata() {
		try {
			const [data, solarData] = await Promise.all([
				fetch(`/api/projects/metadata?client=${encodeURIComponent(client)}`).then((res) => res.json()).catch(() => null),
				fetch(`/api/projects/solar?client=${encodeURIComponent(client)}`).then((res) => res.json()).catch(() => null),
			]);

			if (data) {
				setAddress({
					lat: data?.address?.lat ?? 0,
					lng: data?.address?.lng ?? 0,
				});
			}

			if (solarData) {
				setSolar(solarData);
			} else if (data?.solar) {
				// Fallback to legacy metadata.solar if API fails or doesn't have it, but metadata does
				setSolar(data.solar);
			}
		} finally {
			setLoading(false);
		}
	}

	async function analyzeRoof() {
		try {
			setCalculating(true);

			const data = await fetch('/api/projects/solar', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					lat: address.lat,
					lng: address.lng,
				}),
			})
				.then((res) => res.json())
				.catch(() => setError('Failed to analyze'));

			if (data.error) return setError(data.error);

			setSolar(data);

			await fetch('/api/projects/solar', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					client,
					data,
				}),
			});
		} catch (error) {
			console.error(error);
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

		if (index >= 0) {
			setSelectedConfigIndex(index);
		}
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

	const visiblePanels =
		solar?.solarPanels?.filter((panel: any) => {
			const summary = selectedConfig?.roofSegmentSummaries?.find((x: any) => x.segmentIndex === panel.segmentIndex);

			if (!summary) {
				return false;
			}

			const panelsInSegment = solar.solarPanels.filter((p: any) => p.segmentIndex === panel.segmentIndex);

			const indexInSegment = panelsInSegment.indexOf(panel);

			return indexInSegment < summary?.panelsCount;
		}) ?? [];

	const hasAnalysis = Boolean(solar?.recommended && solar?.configs?.length && solar?.solarPanels?.length);

	if (loading) return <Loading title='Loading Solar Analyzer' description='Checking for existing solar configuration.' />;

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex items-center justify-between'>
				<div>
					<h2 className='text-2xl font-semibold tracking-tight'>Solar Analysis</h2>

					<div className='text-sm text-(--text-muted)'>
						{address.lat.toFixed(6)}, {address.lng.toFixed(6)}
						{solar?.maxSunshineHoursPerYear && (
							<>
								{' • '}
								{Math.round(solar.maxSunshineHoursPerYear).toLocaleString()} sun hours/year
							</>
						)}
					</div>
				</div>

				{has('projects.write') && (
					<Button loading={calculating} onClick={analyzeRoof}>
						<Sun size={16} />
						Analyze Roof
					</Button>
				)}
			</div>

			{!hasAnalysis && (
				<EmptyState
					icon={<Sun size={48} />}
					title='No Solar Analysis Available'
					description={error || 'Run a roof analysis to calculate possible panel layouts, yearly production estimates and optimal panel placement.'}
				/>
			)}

			{hasAnalysis && solar?.solarPanels?.length > 0 && (
				<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
					<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className='rounded-3xl overflow-hidden bg-(--foreground)'>
						<Map
							mapId={'map'}
							defaultCenter={address}
							defaultZoom={20.5}
							mapTypeId='satellite'
							style={{
								width: '100%',
								height: '600px',
							}}>
							{visiblePanels.map((panel: any, index: number) => {
								const segment = selectedConfig?.roofSegmentSummaries?.find((x: any) => x.segmentIndex === panel.segmentIndex);

								const azimuth = segment?.azimuthDegrees ?? 0;

								return (
									<AdvancedMarker
										key={index}
										position={{
											lat: panel.center.latitude,
											lng: panel.center.longitude,
										}}>
										<div
											className='bg-blue-950 border-2 border-white rounded-sm'
											style={{
												width: 20,
												height: 40,
												transform: `rotate(${Math.abs(azimuth)}deg)`,
											}}
										/>
									</AdvancedMarker>
								);
							})}
						</Map>
					</motion.div>
				</APIProvider>
			)}

			{hasAnalysis && solar?.configs?.length > 0 && (
				<div className='rounded-3xl p-6 bg-(--foreground)'>
					{has('projects.write') && (
						<div className='space-y-4'>
							<input
								type='range'
								min={0}
								max={Math.max(configs.length - 1, 0)}
								step={1}
								value={selectedConfigIndex}
								onChange={(e) => setSelectedConfigIndex(Number(e.target.value))}
								className='solar-slider w-full'
							/>

							<div className='flex justify-between text-xs text-(--text-muted)'>
								<span>{configs[0]?.panelsCount ?? 0}</span>

								<span>{configs.at(-1)?.panelsCount ?? 0}</span>
							</div>
						</div>
					)}
				</div>
			)}

			{hasAnalysis && (
				<div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-6'>
					<div className='rounded-3xl p-5 bg-(--foreground)'>
						<div className='flex items-center gap-2 mb-4'>
							<PanelTop size={18} />
							<span>Selected System</span>
						</div>

						<div
							className='mt-3 text-xs px-2 py-1 rounded-full w-fit'
							style={{
								background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
							}}>
							{Math.round((selectedConfig?.panelsCount / solar.recommended?.panelsCount - 1) * 100)}% vs recommendation
						</div>

						<div className='text-4xl font-bold'>{selectedConfig?.panelsCount}</div>

						<div className='text-sm'>Panels</div>

						<div className='mt-3 font-medium'>
							{Math.round(selectedConfig?.yearlyEnergyDcKwh).toLocaleString()}
							kWh/year
						</div>

						<div className='text-sm text-(--text-muted)'>
							≈ {((selectedConfig?.panelsCount * 440) / 1000).toFixed(1)}
							kWp
						</div>
					</div>

					<div className='rounded-3xl p-5 bg-(--accent)/10 border-2 border-(--accent)/70'>
						<div className='flex items-center gap-2 mb-4'>
							<Zap size={18} />
							<span>Recommended</span>
						</div>

						<div className='text-4xl font-bold'>{solar.recommended.panelsCount}</div>

						<div className='text-sm'>Panels</div>

						<div className='mt-3 font-medium'>
							{Math.round(solar.recommended.yearlyEnergyDcKwh).toLocaleString()}
							kWh/year
						</div>

						<div className='text-sm text-(--text-muted)'>
							≈ {((solar.recommended.panelsCount * 440) / 1000).toFixed(1)}
							kWp
						</div>
					</div>
				</div>
			)}

			{hasAnalysis && selectedConfig?.roofSegmentSummaries?.length > 0 && (
				<div className='space-y-4'>
					<div className='flex items-center gap-2'>
						<Sun size={18} className='text-(--accent)' />

						<h3 className='text-lg font-semibold'>Panel Distribution</h3>
					</div>

					<div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
						{selectedConfig.roofSegmentSummaries.map((segment: any, index: number) => (
							<motion.div
								layout
								key={index}
								initial={{
									opacity: 0,
									y: 10,
								}}
								animate={{
									opacity: 1,
									y: 0,
								}}
								className='rounded-3xl p-5 bg-(--foreground)'>
								<div className='flex items-center justify-between'>
									<div>
										<div className='font-semibold'>{getDirection(segment.azimuthDegrees)}</div>

										<div className='text-xs text-(--text-muted)'>Roof Segment</div>
									</div>

									<PanelTop size={18} className='text-(--accent)' />
								</div>

								<div className='grid grid-cols-3 gap-3 mt-5'>
									<div>
										<div className='text-xs text-(--text-muted)'>Panels</div>

										<div className='text-lg font-semibold'>{segment.panelsCount}</div>
									</div>

									<div>
										<div className='text-xs text-(--text-muted)'>Yield</div>

										<div className='text-lg font-semibold'>{Math.round(segment.yearlyEnergyDcKwh).toLocaleString()}</div>
									</div>

									<div>
										<div className='text-xs text-(--text-muted)'>Pitch</div>

										<div className='text-lg font-semibold'>{segment.pitchDegrees?.toFixed(0)}°</div>
									</div>
								</div>

								<div className='mt-4 pt-4 border-t border-(--border)/20'>
									<div className='text-xs text-(--text-muted) mt-1'>Orientation: {segment.azimuthDegrees?.toFixed(0)}°</div>

									<div className='text-xs text-(--text-muted) mt-1'>Estimated production: {Math.round(segment.yearlyEnergyDcKwh).toLocaleString()} kWh/year</div>
								</div>
							</motion.div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
