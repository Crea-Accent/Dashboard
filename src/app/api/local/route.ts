/** @format */

'use server';

import { NextResponse } from 'next/server';
import os from 'os';

function getLocalIp() {
	const interfaces = os.networkInterfaces();

	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name] || []) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}

	return '127.0.0.1';
}

export async function GET() {
	return NextResponse.json(
		{ message: `Local service running on ${getLocalIp()}.`, ip: getLocalIp() },
		{
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET',
				'Access-Control-Allow-Headers': '*',
			},
		}
	);
}
