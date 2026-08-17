/** @format */
'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';

type Toast = {
	id: number;
	type: ToastType;
	message: string;
};

type ToastContextValue = {
	toast: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const counter = useRef(0);

	const addToast = useCallback((type: ToastType, message: string) => {
		const id = ++counter.current;
		setToasts((prev) => [...prev, { id, type, message }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 4500);
	}, []);

	const dismiss = useCallback((id: number) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	return (
		<ToastContext.Provider value={{ toast: addToast }}>
			{children}

			{/* Toast Stack */}
			<div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
				<AnimatePresence initial={false}>
					{toasts.map((t) => (
						<motion.div
							key={t.id}
							initial={{ opacity: 0, y: -12, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: -8, scale: 0.95 }}
							transition={{ duration: 0.2 }}
							className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium min-w-72 max-w-sm backdrop-blur-sm border
								${t.type === 'success' ? 'bg-emerald-600/90 text-white border-emerald-500/30' : 'bg-red-600/90 text-white border-red-500/30'}`}
						>
							<span className="mt-0.5 shrink-0">{t.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}</span>
							<span className="flex-1 leading-snug">{t.message}</span>
							<button onClick={() => dismiss(t.id)} className="mt-0.5 shrink-0 opacity-70 hover:opacity-100 transition-opacity">
								<X size={14} />
							</button>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
	return ctx.toast;
}
