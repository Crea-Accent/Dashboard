import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactCompiler: true,
	images: {
		unoptimized: true,
	},
	turbopack: {
		rules: {
			'*.svg': {
				loaders: ['@svgr/webpack'],
				as: '*.js',
			},
		},
	},
	experimental: {
		proxyClientMaxBodySize: 5000 * 1024 * 1024, // 500 MB
		serverActions: {
			allowedOrigins: ['crea.dummi.me', '*.dummi.me', 'crea-accent.app', '*.crea-accent.app', 'crea-accept.app', '*.crea-accept.app', '172.16.10.211', 'localhost:3000'],
		},
	},
	allowedDevOrigins: ['172.16.10.211', 'crea.dummi.me', '*.dummi.me', 'crea-accent.app', '*.crea-accent.app', 'crea-accept.app', '*.crea-accept.app', 'localhost:3000'],
};

export default nextConfig;
