/** @format */

'use client';

import { useEffect, useState } from 'react';

import Card from './ui/Card';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function EnergyCard() {
	const [energy, setEnergy] = useState<any>(null);

	useEffect(() => {
		const load = async () => {
			try {
				const res = await fetch('/api/energy');

				const { mqtt } = await res.json();

				setEnergy(mqtt);
			} catch (err) {
				console.error(err);
			}
		};

		load();

		const interval = setInterval(load, 2000);

		return () => clearInterval(interval);
	}, []);

	const importing = (energy?.totalPower ?? 0) > 0;

	return (
		<Link href="/dashboard/energy">
			<Card
				className="
					cursor-pointer
					p-6
					transition-all
					hover:border-(--accent)/40
					hover:shadow-md
				"
			>
				<div className="mb-4 flex items-center gap-3">
					<div
						className="
							flex size-12 items-center justify-center
							rounded-2xl
							bg-(--accent)/15
							text-(--accent)
						"
					>
						<Zap size={20} />
					</div>

					<span
						className="
							text-xs
							font-semibold
							uppercase
							tracking-wider
							text-(--text-muted)
						"
					>
						{importing ? 'Import Power' : 'Export Power'}
					</span>
				</div>

				<p className="text-2xl tracking-tight">{Math.abs(energy?.totalPower ?? 0).toLocaleString()} W</p>
			</Card>
		</Link>
	);
}
