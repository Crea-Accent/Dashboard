/** @format */

'use server';

import { NextResponse } from 'next/server';
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
			// Fallback to os.networkInterfaces if no internet route
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

export async function GET() {
	const ip = await getLocalIp();
	return NextResponse.json(
		{ message: `Local service running on ${ip}.`, ip },
		{
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET',
				'Access-Control-Allow-Headers': '*',
			},
		}
	);
}
