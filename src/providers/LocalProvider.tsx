'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Network, X } from 'lucide-react';
import Button from '@/components/ui/Button';

type LocalContextType = {
	local: boolean;
	url: string;
};

const LocalContext = createContext<LocalContextType | null>(null);

export function LocalProvider({ children }: { children: React.ReactNode }) {
	const [local, setLocal] = useState(false);
	const [url, setUrl] = useState('');
	const [localRedirectPrompt, setLocalRedirectPrompt] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			const server = (await fetch('/api/local')
				.then((res) => res.json())
				.catch(() => null)) as { message: string; ip: string; isSameNetwork?: boolean };

			if (server?.isSameNetwork && typeof window !== 'undefined' && window.location.protocol === 'https:') {
				const redirectUrl = `http://${server.ip}:3000${window.location.pathname}${window.location.search}`;
				setLocalRedirectPrompt(redirectUrl);
				// We don't auto-redirect anymore to preserve HTTPS features like camera for the scanner
			}

			if (!server?.ip) {
				setLocal(false);
				setUrl('');
				return;
			}

			const actualIpForCheck =
				server?.ip === '127.0.0.1' && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
					? window.location.hostname
					: server?.ip;
			const local = await fetch(`http://${actualIpForCheck}:3000/api/local`, { signal: AbortSignal.timeout(1500) })
				.then(() => true)
				.catch(() => false);

			const actualIp =
				server?.ip === '127.0.0.1' && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
					? window.location.hostname
					: server?.ip;
			const localUrl = local ? 'http://' + actualIp + ':3000' : '';
			setLocal(local);
			setUrl(localUrl);

			if (local && localUrl && typeof window !== 'undefined') {
				const originalFetch = window.fetch;
				window.fetch = async (...args) => {
					let [resource, config] = args;
					if (typeof resource === 'string' && resource.startsWith('/api/')) {
						resource = localUrl + resource;
					} else if (resource instanceof URL && resource.pathname.startsWith('/api/')) {
						resource = new URL(localUrl + resource.pathname + resource.search);
					}
					return originalFetch(resource, config);
				};
			}
		})();
	}, []);

	return (
		<LocalContext.Provider
			value={{
				local,
				url,
			}}
		>
			{children}

			{localRedirectPrompt && (
				<div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
					<div className="bg-[var(--background)] border border-[var(--border)]/15 shadow-xl rounded-2xl p-4 flex flex-col gap-3 max-w-sm relative">
						<button onClick={() => setLocalRedirectPrompt(null)} className="absolute top-2 right-2 p-1 text-[var(--text-muted)] hover:bg-black/5 rounded-full transition-colors">
							<X size={16} />
						</button>

						<div className="flex items-center gap-3">
							<div className="h-10 w-10 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center shrink-0">
								<Network size={20} />
							</div>
							<div>
								<p className="font-semibold text-sm">Local network detected</p>
								<p className="text-xs text-[var(--text-muted)] mt-0.5">Switch to HTTP for faster local speeds, but some features (like the camera) may be disabled.</p>
							</div>
						</div>

						<div className="flex gap-2">
							<Button variant="ghost" className="flex-1 text-xs h-9" onClick={() => setLocalRedirectPrompt(null)}>
								Stay on HTTPS
							</Button>
							<Button className="flex-1 bg-blue-500 hover:bg-blue-600 border-none text-white text-xs h-9" onClick={() => (window.location.href = localRedirectPrompt)}>
								Switch to Local
							</Button>
						</div>
					</div>
				</div>
			)}
		</LocalContext.Provider>
	);
}

export function useLocal() {
	const ctx = useContext(LocalContext);
	if (!ctx) throw new Error('Local must be used inside LocalProvider');
	return ctx;
}

export function useApiUrl(path: string) {
	const ctx = useContext(LocalContext);
	if (!ctx) return path;

	if (ctx.local && ctx.url && path.startsWith('/api/')) {
		return `${ctx.url}${path}`;
	}

	return path;
}
