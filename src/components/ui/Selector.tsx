/** @format */
'use client';

import { useEffect, useRef, useState } from 'react';

import Button from './Button';
import { ChevronDown } from 'lucide-react';

type Option = {
	label: string;
	value: string;
	color?: string;
};

type Props = {
	value: string;
	options: Option[];
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	hideLabelOnMobile?: boolean;
	onOpenChange?: (open: boolean) => void;
	direction?: 'up' | 'down';
};

export default function Selector({ value, options, onChange, placeholder = 'Select', className, hideLabelOnMobile, onOpenChange, direction = 'down' }: Props) {
	const [open, setOpen] = useState(false);

	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		onOpenChange?.(open);
	}, [open, onOpenChange]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (!ref.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		}

		document.addEventListener('mousedown', handleClickOutside);

		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const selected = options.find((x) => x.value === value);

	const isIconOnly = hideLabelOnMobile && selected?.color;

	return (
		<div ref={ref} className={`relative min-w-60 ${className ?? ''}`}>
			<Button type='button' variant='secondary' onClick={() => setOpen((v) => !v)} className={`w-full flex ${isIconOnly ? 'justify-center sm:justify-between px-0 sm:px-4' : 'justify-between'}`}>
				<div className={`flex min-w-0 items-center ${isIconOnly ? 'sm:gap-3' : 'gap-3'}`}>
					{selected?.color && (
						<div
							className='size-3 shrink-0 rounded-full border-2 border-white/80'
							style={{
								background: selected.color,
							}}
						/>
					)}

					<span className={`truncate ${isIconOnly ? 'hidden sm:block' : ''}`}>{selected?.label ?? placeholder}</span>
				</div>

				<ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''} ${isIconOnly ? 'hidden sm:block' : ''}`} />
			</Button>

			{open && (
				<div className={`absolute z-50 w-full overflow-hidden rounded-2xl border border-(--border)/10 bg-(--foreground) shadow-xl ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
					<div className='max-h-72 overflow-y-auto p-2'>
						{options.map((option) => {
							const isSelected = option.value === value;

							return (
								<Button
									key={option.value}
									type='button'
									variant={isSelected ? 'primary' : 'ghost'}
									onClick={() => {
										onChange(option.value);
										setOpen(false);
									}}
									className='mb-1 w-full justify-start'>
									<div className='flex items-center gap-3'>
										{option.color && (
											<div
												className='size-2.5 rounded-full'
												style={{
													background: option.color,
												}}
											/>
										)}

										<span>{option.label}</span>
									</div>
								</Button>
							);
						})}

						{!options.length && <div className='p-3 text-sm text-(--text-muted)'>No options</div>}
					</div>
				</div>
			)}
		</div>
	);
}
