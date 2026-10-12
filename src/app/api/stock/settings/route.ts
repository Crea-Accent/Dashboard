/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getStockSettings, saveStockSettings, getEanDbApiKey } from '@/lib/eandb';

export async function GET() {
	const session = await getServerSession(authConfig);
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const settings = await getStockSettings();
	const key = getEanDbApiKey(settings);

	const hasKey = Boolean(key && key.trim());
	let maskedKey = '';
	if (key && key.length > 8) {
		maskedKey = `${key.slice(0, 4)}...${key.slice(-4)}`;
	} else if (key) {
		maskedKey = '****';
	}

	return NextResponse.json({
		hasKey,
		maskedKey,
		isEnv: Boolean(process.env.EAN_DB_API_KEY || process.env.EAN_DB_TOKEN),
	});
}

export async function POST(req: NextRequest) {
	const session = await getServerSession(authConfig);
	const permissions = session?.user?.permissions || [];
	const hasAdmin = permissions.includes('admin.write') || permissions.includes('stock.write');

	if (!hasAdmin) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await req.json();
		const current = await getStockSettings();
		const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

		await saveStockSettings({
			...current,
			apiKey,
		});

		return NextResponse.json({ success: true });
	} catch (err: any) {
		return NextResponse.json({ error: err.message || 'Failed to save settings' }, { status: 500 });
	}
}
