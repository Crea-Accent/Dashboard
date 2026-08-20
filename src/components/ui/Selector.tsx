/** @format */
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import Input from './Input';
import { ChevronDown, Search } from 'lucide-react';

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
	disabled?: boolean;
	loading?: boolean;
};

export default function Selector({ value, options, onChange, placeholder = 'Select', className, hideLabelOnMobile, onOpenChange, direction = 'down', disabled, loading }: Props) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ position: 'fixed', opacity: 0, pointerEvents: 'none' });
	const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

	const ref = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setPortalNode(document.body);
	}, []);

	useEffect(() => {
		onOpenChange?.(open);
		if (!open) {
			setSearchQuery('');
			setDropdownStyle({ position: 'fixed', opacity: 0, pointerEvents: 'none' });
		}
	}, [open, onOpenChange]);

	useEffect(() => {
		if (open && ref.current) {
			const rect = ref.current.getBoundingClientRect();
			setDropdownStyle({
				position: 'fixed',
				top: direction === 'up' ? undefined : rect.bottom + 8,
				bottom: direction === 'up' ? window.innerHeight - rect.top + 8 : undefined,
				left: rect.left,
				width: rect.width,
				zIndex: 99999,
				opacity: 1,
				pointerEvents: 'auto',
			});
		}
	}, [open, direction]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (open && !ref.current?.contains(event.target as Node) && !dropdownRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		}

		function handleScroll(event: Event) {
			if (open && !dropdownRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		}

		document.addEventListener('mousedown', handleClickOutside);
		window.addEventListener('scroll', handleScroll, true);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			window.removeEventListener('scroll', handleScroll, true);
		};
	}, [open]);

	const selected = options.find((x) => x.value === value);
	const filteredOptions = options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()));

	const isIconOnly = hideLabelOnMobile && selected?.color;

	return (
		<div ref={ref} className={`relative min-w-60 ${className ?? ''}`}>
			<Button
				type="button"
				variant="secondary"
				loading={loading}
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
				className={`w-full flex ${isIconOnly ? 'justify-center sm:justify-between px-0 sm:px-4' : 'justify-between'}`}
			>
				<div className={`flex min-w-0 items-center ${isIconOnly ? 'sm:gap-3' : 'gap-3'}`}>
					{selected?.color && (
						<div
							className="size-3 shrink-0 rounded-full border-2 border-white/80"
							style={{
								background: selected.color,
							}}
						/>
					)}

					<span className={`truncate ${isIconOnly ? 'hidden sm:block' : ''}`}>{selected?.label ?? placeholder}</span>
				</div>

				<ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''} ${isIconOnly ? 'hidden sm:block' : ''}`} />
			</Button>

			{open &&
				portalNode &&
				createPortal(
					<div ref={dropdownRef} style={dropdownStyle} className={`overflow-hidden rounded-2xl border border-(--border)/10 bg-(--foreground) shadow-xl flex flex-col max-h-72`}>
						{options.length > 5 && (
							<div className="p-2 pb-0 shrink-0">
								<Input
									autoFocus
									placeholder="Search..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full !py-1.5"
									icon={<Search size={14} className="text-(--text-muted)" />}
								/>
							</div>
						)}

						<div className="overflow-y-auto p-2 flex-1 min-h-0">
							{filteredOptions.map((option) => {
								const isSelected = option.value === value;

								return (
									<Button
										key={option.value}
										type="button"
										variant={isSelected ? 'primary' : 'ghost'}
										onClick={() => {
											onChange(option.value);
											setOpen(false);
										}}
										className="mb-1 w-full justify-start"
									>
										<div className="flex items-center gap-3">
											{option.color && (
												<div
													className="size-2.5 shrink-0 rounded-full"
													style={{
														background: option.color,
													}}
												/>
											)}

											<span className="truncate">{option.label}</span>
										</div>
									</Button>
								);
							})}

							{!filteredOptions.length && <div className="p-3 text-sm text-(--text-muted) text-center">No options found</div>}
						</div>
					</div>,
					portalNode
				)}
		</div>
	);
}
