/** @format */
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type LocalContextType = {
	local: boolean;
	url: string;
};

const LocalContext = createContext<LocalContextType | null>(null);

export function LocalProvider({ children }: { children: React.ReactNode }) {
	const [local, setLocal] = useState(false);
	const [url, setUrl] = useState('');

	useEffect(() => {
		(async () => {
			const server = (await fetch('/api/local')
				.then((res) => res.json())
				.catch(() => null)) as { message: string; ip: string; isSameNetwork?: boolean };

			if (server?.isSameNetwork && typeof window !== 'undefined' && window.location.protocol === 'https:') {
				window.location.href = `http://${server.ip}:3000${window.location.pathname}${window.location.search}`;
				return;
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
