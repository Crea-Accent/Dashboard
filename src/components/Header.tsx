/** @format */

'use client';

import { useState, useEffect } from 'react';
import { PanelLeft, PanelLeftClose, Search } from 'lucide-react';

import Button from './ui/Button';
import { HEADER_HEIGHT } from '@/lib/layout';
import Icon from '@/../public/favicon.svg';
import Link from 'next/link';
import { useSidebar } from '../providers/SidebarProvider';
import CommandPalette from './CommandPalette';

export default function Header() {
	const { toggle, open } = useSidebar();
	const [paletteOpen, setPaletteOpen] = useState(false);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				setPaletteOpen((prev) => !prev);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);

	return (
		<>
			<header
				className="fixed w-full top-0 z-40 backdrop-blur-xl transition-all duration-300 print:hidden"
				style={{
					height: HEADER_HEIGHT,
					background: 'color-mix(in srgb, var(--background) 80%, transparent)',
				}}
			>
				<div className="flex items-center h-full px-4 md:px-6 relative gap-3">
					{/* Sidebar Toggle */}
					<Button
						variant="ghost"
						onClick={toggle}
						className="z-10000"
						icon={open ? <PanelLeftClose size={24} strokeWidth={1.8} /> : <PanelLeft size={24} strokeWidth={1.8} />}
						style={{
							color: 'var(--text)',
						}}
					/>

					{/* Logo */}
					<Link href="/" className="absolute inset-0 flex items-center justify-center md:relative md:inset-auto md:justify-start md:ml-2 transition-all duration-300 hover:opacity-90">
						<div
							className="transition-all duration-500"
							style={{
								filter: 'drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 20%, transparent))',
							}}
						>
							<Icon className="h-9 w-auto" />
						</div>
					</Link>

					{/* Spacer for desktop alignment */}
					<div className="hidden md:block flex-1" />

					{/* Quick Command Palette Trigger */}
					<button
						type="button"
						onClick={() => setPaletteOpen(true)}
						className="z-10000 ml-auto md:ml-0 flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[var(--foreground)]/80 hover:bg-[var(--foreground)] border border-[var(--border)]/15 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
						title="Quick Search (Ctrl+K)"
					>
						<Search size={14} className="text-[var(--accent)]" />
						<span className="hidden sm:inline">Quick search...</span>
						<kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--background)] border border-[var(--border)]/15">Ctrl+K</kbd>
					</button>

					<div id="header-user-list" className="z-10000 relative" />
				</div>

				<div
					className="absolute bottom-0 left-0 h-px w-full pointer-events-none"
					style={{
						background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 40%, transparent), transparent)',
					}}
				/>
			</header>

			<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
		</>
	);
}
