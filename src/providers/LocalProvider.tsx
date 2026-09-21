'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Network, X, Server, Globe } from 'lucide-react';

type LocalContextType = {
	local: boolean;
	url: string;
};

const LocalContext = createContext<LocalContextType | null>(null);

export function LocalProvider({ children }: { children: React.ReactNode }) {
	const [local, setLocal] = useState(false);
	const [url, setUrl] = useState('');
	const [serverIp, setServerIp] = useState<string | null>(null);
	const [isSameNetwork, setIsSameNetwork] = useState(false);

	const [isOpen, setIsOpen] = useState(false);
	const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			if (window.location.protocol === 'https:') {
				localStorage.setItem('tunnel_url', window.location.origin);
				setTunnelUrl(window.location.origin);
			} else {
				setTunnelUrl(localStorage.getItem('tunnel_url'));
			}
		}

		(async () => {
			const server = (await fetch('/api/local')
				.then((res) => res.json())
				.catch(() => null)) as { message: string; ip: string; isSameNetwork?: boolean };

			if (server?.ip) {
				setServerIp(server.ip);
				setIsSameNetwork(!!server.isSameNetwork);
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
			const isLocalAlive = await fetch(`http://${actualIpForCheck}:3000/api/local`, { signal: AbortSignal.timeout(1500) })
				.then(() => true)
				.catch(() => false);

			const actualIp =
				server?.ip === '127.0.0.1' && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
					? window.location.hostname
					: server?.ip;
			const localUrl = isLocalAlive ? 'http://' + actualIp + ':3000' : '';
			setLocal(isLocalAlive);
			setUrl(localUrl);

			if (isLocalAlive && localUrl && typeof window !== 'undefined') {
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

	const isCurrentlyHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
	const showNetworkButton = isSameNetwork || (!isCurrentlyHttps && tunnelUrl);

	const handleSwitchToLocal = () => {
		if (serverIp && typeof window !== 'undefined') {
			window.location.href = `http://${serverIp}:3000${window.location.pathname}${window.location.search}`;
		}
	};

	const handleSwitchToTunnel = () => {
		if (tunnelUrl && typeof window !== 'undefined') {
			window.location.href = `${tunnelUrl}${window.location.pathname}${window.location.search}`;
		}
	};

	return (
		<LocalContext.Provider value={{ local, url }}>
			{children}

			{showNetworkButton && (
				<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
					{isOpen && (
						<div className="bg-[var(--foreground)] border border-[var(--border)]/15 shadow-xl rounded-2xl p-4 flex flex-col gap-4 w-72 animate-in slide-in-from-bottom-2 fade-in duration-200">
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-[var(--text)] text-sm flex items-center gap-2">
									<Network size={16} className="text-[var(--accent)]" />
									Connection Type
								</h3>
								<button onClick={() => setIsOpen(false)} className="p-1 text-[var(--text-muted)] hover:bg-[var(--border)]/20 rounded-full transition-colors">
									<X size={16} />
								</button>
							</div>

							<div className="space-y-2">
								<button
									onClick={handleSwitchToLocal}
									disabled={!isCurrentlyHttps}
									className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border text-left ${!isCurrentlyHttps ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)] cursor-default' : 'bg-[var(--background)] border-[var(--border)]/15 hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 text-[var(--text)]'}`}
								>
									<Server size={18} className={!isCurrentlyHttps ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
									<div className="flex-1">
										<p className="text-sm font-medium">Local Network</p>
										<p className="text-xs opacity-80 mt-0.5">{!isCurrentlyHttps ? 'Currently active' : 'Switch for speed'}</p>
									</div>
								</button>

								<button
									onClick={handleSwitchToTunnel}
									disabled={isCurrentlyHttps}
									className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border text-left ${isCurrentlyHttps ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)] cursor-default' : 'bg-[var(--background)] border-[var(--border)]/15 hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 text-[var(--text)]'}`}
								>
									<Globe size={18} className={isCurrentlyHttps ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
									<div className="flex-1">
										<p className="text-sm font-medium">Secure Tunnel</p>
										<p className="text-xs opacity-80 mt-0.5">{isCurrentlyHttps ? 'Currently active' : 'Switch for camera access'}</p>
									</div>
								</button>
							</div>
						</div>
					)}

					<button
						onClick={() => setIsOpen(!isOpen)}
						className="h-12 w-12 bg-[var(--foreground)] border border-[var(--border)]/15 text-[var(--text)] rounded-full shadow-lg flex items-center justify-center hover:scale-105 hover:border-[var(--accent)] active:scale-95 transition-all focus:outline-none"
						title="Network Connection Settings"
					>
						<Network size={22} className={isCurrentlyHttps ? 'text-[var(--text)]' : 'text-[var(--accent)]'} />
					</button>
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
