/** @format */

'use server';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import dgram from 'dgram';

async function getLocalIp(): Promise<string> {
	return new Promise((resolve) => {
		const socket = dgram.createSocket('udp4');
		socket.connect(53, '8.8.8.8', () => {
			const ip = socket.address().address;
			socket.close();
			resolve(ip);
		});
		socket.on('error', () => {
			socket.close();
			const os = require('os');
			const interfaces = os.networkInterfaces();
			for (const name of Object.keys(interfaces)) {
				if (name.toLowerCase().includes('veth') || name.toLowerCase().includes('docker') || name.toLowerCase().includes('wsl') || name.toLowerCase().includes('virtual')) continue;
				for (const iface of interfaces[name] || []) {
					if (iface.family === 'IPv4' && !iface.internal) {
						resolve(iface.address);
						return;
					}
				}
			}
			resolve('127.0.0.1');
		});
	});
}

let cachedServerIp: string | null = null;
let lastFetch = 0;
async function getServerPublicIp() {
	if (cachedServerIp && Date.now() - lastFetch < 3600000) return cachedServerIp;
	try {
		const res = await fetch('https://api.ipify.org');
		if (res.ok) {
			cachedServerIp = (await res.text()).trim();
			lastFetch = Date.now();
		}
	} catch {}
	return cachedServerIp || 'unknown';
}

export async function GET(request: NextRequest) {
	const ip = await getLocalIp();
	const serverPublicIp = await getServerPublicIp();
	const clientIps = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || '';

	// Check if the client is connecting from the same public IP as the server
	const isSameNetwork = !!clientIps && serverPublicIp !== 'unknown' && clientIps.includes(serverPublicIp);

	return NextResponse.json(
		{ message: `Local service running on ${ip}.`, ip, isSameNetwork },
		{
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET',
				'Access-Control-Allow-Headers': '*',
			},
		}
	);
}
