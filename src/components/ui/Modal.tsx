/** @format */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useEffect } from 'react';

import Button from './Button';
import { X } from 'lucide-react';

type Props = {
	open: boolean;
	title: string;
	children: ReactNode;
	onClose: () => void;
	footer?: ReactNode;
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
};

export default function Modal({ open, title, children, onClose, footer, size = 'md' }: Props) {
	const widths = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		xxl: 'max-w-7xl',
	};

	useEffect(() => {
		if (!open) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};

		window.addEventListener('keydown', onKeyDown);

		return () => window.removeEventListener('keydown', onKeyDown);
	}, [open, onClose]);

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
				>
					<motion.div
						initial={{
							opacity: 0,
							scale: 0.97,
							y: 16,
						}}
						animate={{
							opacity: 1,
							scale: 1,
							y: 0,
						}}
						exit={{
							opacity: 0,
							scale: 0.97,
							y: 16,
						}}
						transition={{
							type: 'spring',
							stiffness: 320,
							damping: 28,
						}}
						onClick={(e) => e.stopPropagation()}
						className={`
							w-full
							${widths[size]}
							max-h-[90vh]
							flex flex-col
							rounded-3xl
							bg-(--foreground)
							border
							border-(--border)/10
							shadow-2xl
							overflow-hidden
						`}
					>
						<div className="flex items-center justify-between border-b border-(--border)/10 px-6 py-5">
							<h2 className="text-xl font-semibold">{title}</h2>

							<Button variant="ghost" size="sm" icon={<X size={16} />} onClick={onClose} />
						</div>

						<div className="flex-1 overflow-y-auto p-6">{children}</div>

						{footer && <div className="flex justify-end gap-3 border-t border-(--border)/10 px-6 py-5">{footer}</div>}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
