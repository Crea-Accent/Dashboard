/** @format */
'use client';

import { HEADER_HEIGHT, SIDEBAR_WIDTH } from '@/lib/layout';

import { motion } from 'framer-motion';
import { useSidebar } from '../providers/SidebarProvider';

export function SidebarLayout({ children }: { children: React.ReactNode }) {
	const { open } = useSidebar();

	return (
		<motion.main
			animate={{
				marginLeft: open ? SIDEBAR_WIDTH : 0,
			}}
			transition={{ duration: 0.25 }}
			style={{
				height: `calc(100dvh - ${HEADER_HEIGHT}px)`,
			}}
			className="px-4 md:px-6 py-6 md:ml-0 md:transition-[margin] flex flex-col"
		>
			{children}
		</motion.main>
	);
}
