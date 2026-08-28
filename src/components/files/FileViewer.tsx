/** @format */
'use client';

import { AnimatePresence, motion } from 'framer-motion';

import Button from '../ui/Button';
import Image from 'next/image';
import { useApiUrl } from '@/providers/LocalProvider';
import { X } from 'lucide-react';
import { useEffect } from 'react';

type Props = {
	file: {
		name: string;
		path: string;
	} | null;

	open: boolean;

	onClose: () => void;
};

export default function FileViewer({ file, open, onClose }: Props) {
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', onKeyDown);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [onClose]);

	return (
		<AnimatePresence>
			{open && file && (
				<motion.div
					className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-8"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
				>
					{/* Close Button */}
					<motion.div
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.8 }}
						transition={{ delay: 0.05 }}
						className="absolute top-6 right-6 z-10"
					>
						<Button
							onClick={(e) => {
								e.stopPropagation();
								onClose();
							}}
							className="!rounded-full backdrop-blur-md bg-white/10 hover:bg-white/20 border border-white/10 text-white"
						>
							<X size={18} />
						</Button>
					</motion.div>

					{/* Image / Video */}
					<motion.div
						className="relative w-full h-full flex items-center justify-center"
						initial={{ opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.96 }}
						transition={{
							type: 'spring',
							stiffness: 220,
							damping: 24,
						}}
						onClick={(e) => e.stopPropagation()}
					>
						{['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(file.name.split('.').pop()?.toLowerCase() || '') ? (
							<video src={`/api/files/download?path=${encodeURIComponent(file.path)}`} controls autoPlay className="max-w-full max-h-full object-contain" />
						) : (
							<Image src={`/api/files/download?path=${encodeURIComponent(file.path)}`} alt={file.name} fill className="object-contain" priority />
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
