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
	},
	allowedDevOrigins: ['172.16.10.240'],
};

export default nextConfig;
