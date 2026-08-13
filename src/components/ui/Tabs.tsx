/** @format */

'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import Selector from './Selector';
import { motion } from 'framer-motion';

type Tab<T extends string> = {
	id: T;
	label: string;
	icon?: React.ReactNode;
	count?: number;
	color?: string;
};

type Props<T extends string> = {
	value: T;
	onChange: (value: any) => void;
	tabs: Tab<T>[];
	className?: string;
};

export default function Tabs<T extends string>({ value, onChange, tabs }: Props<T>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

	const [indicator, setIndicator] = useState({
		left: 0,
		width: 0,
		top: 0,
		height: 0,
	});

	useLayoutEffect(() => {
		const active = tabRefs.current[value];

		if (!active || !containerRef.current) return;

		setIndicator({
			left: active.offsetLeft,
			width: active.offsetWidth,
			top: active.offsetTop,
			height: active.offsetHeight,
		});
	}, [value, tabs]);

	return (
		<div className='w-full lg:w-auto'>
			{/* Mobile / Tablet / Small Desktop */}
			<div className='xl:hidden w-full'>
				<Selector
					className='w-full'
					value={value}
					onChange={(v) => onChange(v as T)}
					options={tabs.map((tab) => ({
						label: tab.label,
						value: tab.id,
						color: tab.color,
					}))}
				/>
			</div>

			{/* Large Desktop */}
			<div ref={containerRef} className='hidden xl:flex flex-nowrap relative rounded-2xl bg-(--foreground) p-1 gap-1'>
				<motion.div
					className='absolute rounded-xl bg-(--accent) shadow-lg'
					animate={{
						left: indicator.left,
						width: indicator.width,
						top: indicator.top,
						height: indicator.height,
					}}
					transition={{
						type: 'spring',
						stiffness: 500,
						damping: 35,
					}}
				/>

				{tabs.map((tab) => {
					const active = tab.id === value;

					return (
						<button
							key={tab.id}
							ref={(el) => {
								tabRefs.current[tab.id] = el;
							}}
							onClick={() => onChange(tab.id)}
							className='relative z-10 h-10 px-4 text-sm rounded-2xl inline-flex items-center justify-center gap-2 font-medium select-none transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'>
							{tab.icon && (
								<span
									className={`
			relative z-10
			transition-colors

			${active ? 'text-white' : 'text-(--text-muted)'}
		`}>
									{tab.icon}
								</span>
							)}

							<span
								className={`
		relative z-10
		transition-colors

		${active ? 'text-white' : ''}
	`}>
								{tab.label}
							</span>

							{tab.count !== undefined && (
								<span
									className={`
									min-w-5
									h-5
									px-1.5
									rounded-full
									text-xs
									inline-flex
									items-center
									justify-center
									transition-colors

									${active ? 'bg-white/20 text-white' : 'bg-(--accent)/15 text-(--accent)'}
								`}>
									{tab.count}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
