/** @format */
'use client';

import { useEffect, useRef, useState } from 'react';

import Button from './Button';
import { ChevronDown } from 'lucide-react';

type Option = {
	label: string;
	value: string;
	color?: string;
	icon?: React.ReactNode;
};

type Props = {
	label?: string;
	value: string[];
	options: Option[];
	onChange: (value: string[]) => void;
	placeholder?: string;
	className?: string;
};

export default function MultiSelector({ value, options, onChange, placeholder = 'Select', className, label }: Props) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (!ref.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		}

		document.addEventListener('mousedown', handleClickOutside);

		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	function toggle(option: string) {
		if (value.includes(option)) {
			onChange(value.filter((x) => x !== option));
			return;
		}

		onChange([...value, option]);
	}

	function displayValue() {
		if (!value.length) return placeholder;

		if (value.length === 1) {
			return options.find((x) => x.value === value[0])?.label ?? placeholder;
		}

		if (value.length === 2) {
			return value
				.map((v) => options.find((x) => x.value === v)?.label)
				.filter(Boolean)
				.join(', ');
		}

		return `${value.length} selected`;
	}

	return (
		<div ref={ref} className={`relative min-w-60 ${className ?? ''}`}>
			{label && <label className="mb-2 block text-sm font-medium text-(--text)">{label}</label>}

			<Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)} className="w-full justify-between">
				<div className="flex items-center gap-3 overflow-hidden">
					{!!value.length && (
						<div className="flex -space-x-1">
							{value.slice(0, 3).map((selectedValue) => {
								const option = options.find((x) => x.value === selectedValue);

								return option?.icon ? (
									<div key={selectedValue} className="shrink-0 scale-75">
										{option.icon}
									</div>
								) : (
									<div
										key={selectedValue}
										className="size-3 rounded-full border-2 border-[var(--background)] shrink-0"
										style={{
											background: option?.color ?? 'var(--accent)',
										}}
									/>
								);
							})}
						</div>
					)}

					<span className="truncate">{displayValue()}</span>
				</div>

				<ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
			</Button>

			{open && (
				<div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-(--border)/10 bg-(--foreground) shadow-xl">
					<div className="max-h-72 overflow-y-auto p-2">
						{options.map((option) => {
							const selected = value.includes(option.value);

							return (
								<Button key={option.value} type="button" variant={selected ? 'primary' : 'ghost'} onClick={() => toggle(option.value)} className="mb-1 w-full justify-start">
									<div className="flex items-center gap-3">
										{option.icon ? (
											<div className="shrink-0">{option.icon}</div>
										) : (
											<div
												className="size-2.5 rounded-full shrink-0"
												style={{
													background: option.color ?? 'var(--accent)',
												}}
											/>
										)}

										<span>{option.label}</span>
									</div>
								</Button>
							);
						})}

						{!options.length && <div className="p-3 text-sm text-(--text-muted)">No options</div>}
					</div>
				</div>
			)}
		</div>
	);
}
