/** @format */

'use client';

import { Activity, useEffect, useState } from 'react';
import { ActivityIcon, ArrowDownToLine, ArrowUpFromLine, Battery, Factory, Gauge, SolarPanel, Thermometer, Zap } from 'lucide-react';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';

type Phase = {
	lines: any[];
	voltage?: number;
};

export default function Page() {
	const [mqtt, setMqtt] = useState<any>(null);
	const [modbus, setModbus] = useState<any>(null);

	const [showSmappee, setShowSmappee] = useState(true);
	const [showFusionSolar, setShowFusionSolar] = useState(true);

	const [channels, setChannels] = useState<{
		l1?: Phase;
		l2?: Phase;
		l3?: Phase;
	}>({});

	const mqttSolar = mqtt?.channelPowers?.filter(({ publishIndex }: any) => publishIndex >= 3).reduce((a: number, b: any) => a + b.power, 0) ?? null;

	const mqttGrid = mqtt?.channelPowers?.filter(({ publishIndex }: any) => publishIndex <= 2).reduce((a: number, b: any) => a + b.power, 0) ?? null;

	const mqttProduction = mqttSolar;

	const mqttConsumption = mqttSolar !== null && mqttGrid !== null ? Math.abs(mqttSolar + mqttGrid) : null;

	const mqttImport = mqttGrid !== null && mqttGrid > 0 ? mqttGrid : null;

	const mqttExport = mqttGrid !== null && mqttGrid < 0 ? Math.abs(mqttGrid) : null;

	const modbusProduction = modbus?.production ?? null;

	const modbusConsumption = modbus?.consumption ?? null;

	const modbusImport = modbus?.meterPower > 0 ? Math.abs(modbus.meterPower) : null;

	const modbusExport = modbus?.meterPower < 0 ? modbus.meterPower : null;

	function rangeValue(...values: (number | null | undefined)[]) {
		const valid = values.filter((v): v is number => typeof v === 'number');

		if (!valid.length) return '—';

		if (valid.length === 1) return Math.round(valid[0]).toLocaleString();

		return `${Math.round(Math.min(...valid)).toLocaleString()} ~ ${Math.round(Math.max(...valid)).toLocaleString()}`;
	}

	useEffect(() => {
		const load = async () => {
			try {
				const res = await fetch('/api/energy');

				const data = await res.json();

				const mqttData = data.mqtt;
				const modbusData = data.modbus;

				setMqtt(mqttData);
				setModbus(modbusData);

				if (!mqttData) return;

				const l1 = {
					lines: mqttData.channelPowers.filter(({ phaseId }: any) => phaseId === 0),
					...mqttData.voltages.find(({ phaseId }: any) => phaseId === 0),
				};

				const l2 = {
					lines: mqttData.channelPowers.filter(({ phaseId }: any) => phaseId === 1),
					...mqttData.voltages.find(({ phaseId }: any) => phaseId === 1),
				};

				const l3 = {
					lines: mqttData.channelPowers.filter(({ phaseId }: any) => phaseId === 2),
					...mqttData.voltages.find(({ phaseId }: any) => phaseId === 2),
				};

				setChannels({
					l1,
					l2,
					l3,
				});
			} catch (err) {
				console.error(err);
			}
		};

		load();

		const interval = setInterval(load, 2000);

		return () => clearInterval(interval);
	}, []);

	return (
		<div className="space-y-8">
			<PageHeader
				icon={<Zap size={20} />}
				title="Energy Dashboard"
				description="Live monitoring of grid usage, solar production and per-phase activity."
				action={
					<div className="flex gap-2">
						<Button variant={showSmappee ? 'primary' : 'secondary'} onClick={() => setShowSmappee((v) => !v)}>
							Smappee
						</Button>

						<Button variant={showFusionSolar ? 'primary' : 'secondary'} onClick={() => setShowFusionSolar((v) => !v)}>
							FusionSolar
						</Button>
					</div>
				}
			/>

			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
				<OverviewCard label="Consumption" value={rangeValue(showSmappee ? mqttConsumption : null, showFusionSolar ? modbusConsumption : null)} icon={<Factory size={18} />} />

				<OverviewCard label="Production" value={rangeValue(showSmappee ? mqttProduction : null, showFusionSolar ? modbusProduction : null)} icon={<SolarPanel size={18} />} />

				<OverviewCard label="Import" value={rangeValue(showSmappee ? mqttImport : null, showFusionSolar ? modbusImport : null)} icon={<ArrowDownToLine size={18} />} />

				<OverviewCard label="Export" value={rangeValue(showSmappee ? mqttExport : null, showFusionSolar ? modbusExport : null)} icon={<ArrowUpFromLine size={18} />} />
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
				<PhaseCard title="L1" smappee={channels.l1} modbus={modbus?.l1} showSmappee={showSmappee} showFusionSolar={showFusionSolar} />

				<PhaseCard title="L2" smappee={channels.l2} modbus={modbus?.l2} showSmappee={showSmappee} showFusionSolar={showFusionSolar} />

				<PhaseCard title="L3" smappee={channels.l3} modbus={modbus?.l3} showSmappee={showSmappee} showFusionSolar={showFusionSolar} />
			</div>

			{showFusionSolar && modbus && (
				<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
					<BatteryCard data={modbus} />

					<InverterCard data={modbus} />
				</div>
			)}

			{showFusionSolar && modbus && <PVCard data={modbus} />}
		</div>
	);
}

function OverviewCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
	return (
		<Card className="p-6">
			<div className="flex items-center gap-3 mb-5">
				<div
					className="
						w-10 h-10 rounded-xl
						bg-(--active-accent)
						dark:bg-(--accent)/20
						text-(--accent)
						flex items-center justify-center
					"
				>
					{icon}
				</div>

				<span
					className="
						text-xs uppercase tracking-wide
						font-medium
						text-zinc-500 dark:text-zinc-400
					"
				>
					{label}
				</span>
			</div>

			<div className="flex items-end gap-2">
				<p className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>

				<span className="text-zinc-500 pb-1">W</span>
			</div>
		</Card>
	);
}

function PhaseCard({ title, smappee, modbus, showSmappee, showFusionSolar }: { title: string; smappee?: Phase; modbus?: any; showSmappee: boolean; showFusionSolar: boolean }) {
	const grid = smappee?.lines?.[0];
	const solar = smappee?.lines?.[1];

	const gridPower = (modbus?.grid?.voltage ?? 0) * (modbus?.grid?.current ?? 0);

	const solarPower = (modbus?.solar?.voltage ?? 0) * (modbus?.solar?.current ?? 0);

	function displayValue(...values: (number | null | undefined)[]) {
		const valid = values.filter((v): v is number => typeof v === 'number');

		if (!valid.length) return '—';

		if (valid.length === 1) return Math.round(valid[0]).toLocaleString();

		return `${Math.round(valid[0]).toLocaleString()} ~ ${Math.round(valid[1]).toLocaleString()}`;
	}

	return (
		<Card className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>

					<p className="text-sm text-zinc-500 dark:text-zinc-400">{displayValue(showSmappee ? smappee?.voltage : undefined, showFusionSolar ? modbus?.grid?.voltage : undefined)}V</p>
				</div>

				<div
					className="
						w-11 h-11 rounded-xl
						bg-(--active-accent)
						dark:bg-(--accent)/20
						text-(--accent)
						flex items-center justify-center
					"
				>
					<Zap size={18} />
				</div>
			</div>

			<div className="space-y-4">
				<CombinedRow
					label="Grid"
					power={displayValue(showSmappee ? Math.abs(grid?.power ?? 0) : undefined, showFusionSolar ? gridPower : undefined)}
					current={displayValue(showSmappee ? grid?.current / 10 : undefined, showFusionSolar ? modbus?.grid?.current : undefined)}
					cosphi={grid?.cosPhi}
				/>

				<CombinedRow
					label="Solar"
					power={displayValue(showSmappee ? Math.abs(solar?.power ?? 0) : undefined, showFusionSolar ? solarPower : undefined)}
					current={displayValue(showSmappee ? solar?.current / 10 : undefined, showFusionSolar ? modbus?.solar?.current : undefined)}
					cosphi={solar?.cosPhi}
				/>
			</div>
		</Card>
	);
}

function CombinedRow({ label, power, current, cosphi }: { label: string; power: string; current: string; cosphi?: number }) {
	return (
		<div
			className="
				rounded-xl
				bg-zinc-50 dark:bg-zinc-800/50
				border border-zinc-200 dark:border-zinc-800
				p-4
			"
		>
			<div className="flex items-center justify-between mb-3">
				<p className="font-medium text-zinc-900 dark:text-zinc-100">{label}</p>

				{cosphi !== undefined && <p className="text-xs text-zinc-500 dark:text-zinc-400">cosφ {(cosphi / 100).toFixed(2)}</p>}
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<p className="text-xs text-zinc-500 mb-1">Power</p>

					<p className="text-xl font-semibold">{power}W</p>
				</div>

				<div>
					<p className="text-xs text-zinc-500 mb-1">Current</p>

					<p className="text-xl font-semibold">{current}A</p>
				</div>
			</div>
		</div>
	);
}

function BatteryCard({ data }: { data: any }) {
	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-6">
				<div>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">Battery</p>

					<h2 className="text-xl font-semibold">{data.state.battery}</h2>
				</div>

				<div
					className="
						w-11 h-11 rounded-xl
						bg-(--active-accent)
						dark:bg-(--accent)/20
						text-(--accent)
						flex items-center justify-center
					"
				>
					<Battery size={20} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-5">
				<div>
					<p className="text-xs text-zinc-500 mb-1">State of Charge</p>

					<p className="text-3xl font-semibold">{data.battery.state}%</p>
				</div>

				<div>
					<p className="text-xs text-zinc-500 mb-1">Power</p>

					<p className="text-3xl font-semibold">{data.battery.load.toLocaleString()}W</p>
				</div>

				<div>
					<p className="text-xs text-zinc-500 mb-1">Lifetime Charge</p>

					<p className="text-lg font-medium">
						{data.battery.charge}
						kWh
					</p>
				</div>

				<div>
					<p className="text-xs text-zinc-500 mb-1">Lifetime Discharge</p>

					<p className="text-lg font-medium">
						{data.battery.discharge}
						kWh
					</p>
				</div>
			</div>
		</Card>
	);
}

function InverterCard({ data }: { data: any }) {
	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-6">
				<div>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">Inverter</p>

					<h2 className="text-xl font-semibold">{data.state.inverter}</h2>
				</div>

				<div
					className="
						w-11 h-11 rounded-xl
						bg-(--active-accent)
						dark:bg-(--accent)/20
						text-(--accent)
						flex items-center justify-center
					"
				>
					<Zap size={20} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-5">
				<div>
					<p className="text-xs text-zinc-500 mb-1">Output Power</p>

					<p className="text-3xl font-semibold">{Math.round(data.inverterPower)}W</p>
				</div>

				<div>
					<p className="text-xs text-zinc-500 mb-1">Efficiency</p>

					<p className="text-3xl font-semibold">{(data.efficiency * 100).toFixed(1)}%</p>
				</div>

				<div>
					<div className="flex items-center gap-2 mb-1">
						<Thermometer size={14} />

						<p className="text-xs text-zinc-500">Temperature</p>
					</div>

					<p className="text-lg font-medium">
						{data.internalTemp}
						°C
					</p>
				</div>

				<div>
					<div className="flex items-center gap-2 mb-1">
						<Gauge size={14} />

						<p className="text-xs text-zinc-500">Frequency</p>
					</div>

					<p className="text-lg font-medium">
						{data.frequency}
						Hz
					</p>
				</div>

				<div>
					<div className="flex items-center gap-2 mb-1">
						<ActivityIcon size={14} />

						<p className="text-xs text-zinc-500">Power Factor</p>
					</div>

					<p className="text-lg font-medium">{data.powerFactor}</p>
				</div>

				<div>
					<p className="text-xs text-zinc-500 mb-1">Insulation</p>

					<p className="text-lg font-medium">{data.insulationResist}Ω</p>
				</div>
			</div>
		</Card>
	);
}

function PVCard({ data }: { data: any }) {
	const pv1Power = (data.pv1?.voltage ?? 0) * (data.pv1?.current ?? 0);

	const pv2Power = (data.pv2?.voltage ?? 0) * (data.pv2?.current ?? 0);

	const totalPower = pv1Power + pv2Power;

	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-6">
				<div>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">PV Strings</p>

					<h2 className="text-xl font-semibold">{Math.round(totalPower).toLocaleString()}W</h2>
				</div>

				<div
					className="
						w-11 h-11 rounded-xl
						bg-(--active-accent)
						dark:bg-(--accent)/20
						text-(--accent)
						flex items-center justify-center
					"
				>
					<SolarPanel size={20} />
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
				<div
					className="
						rounded-xl
						border border-zinc-200 dark:border-zinc-800
						p-4
					"
				>
					<div className="flex items-center justify-between mb-4">
						<h3 className="font-medium">PV1</h3>

						<span className="text-xs text-zinc-500">{Math.round(pv1Power)}W</span>
					</div>

					<div className="space-y-3">
						<div className="flex justify-between">
							<span className="text-zinc-500 text-sm">Voltage</span>

							<span className="font-medium">{data.pv1?.voltage}V</span>
						</div>

						<div className="flex justify-between">
							<span className="text-zinc-500 text-sm">Current</span>

							<span className="font-medium">{data.pv1?.current}A</span>
						</div>
					</div>
				</div>

				<div
					className="
						rounded-xl
						border border-zinc-200 dark:border-zinc-800
						p-4
					"
				>
					<div className="flex items-center justify-between mb-4">
						<h3 className="font-medium">PV2</h3>

						<span className="text-xs text-zinc-500">{Math.round(pv2Power)}W</span>
					</div>

					<div className="space-y-3">
						<div className="flex justify-between">
							<span className="text-zinc-500 text-sm">Voltage</span>

							<span className="font-medium">{data.pv2?.voltage}V</span>
						</div>

						<div className="flex justify-between">
							<span className="text-zinc-500 text-sm">Current</span>

							<span className="font-medium">{data.pv2?.current}A</span>
						</div>
					</div>
				</div>
			</div>

			<div
				className="
					mt-5
					pt-5
					border-t border-zinc-200 dark:border-zinc-800
					flex items-center justify-between
				"
			>
				<span className="text-sm text-zinc-500">Combined DC Power</span>

				<span className="text-lg font-semibold">{Math.round(totalPower).toLocaleString()}W</span>
			</div>
		</Card>
	);
}
