/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authConfig);
		if (!session || !session.user) {
			return NextResponse.json({ error: 'Niet geautoriseerd: geen actieve sessie gevonden.' }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		const items: { code: string; quantity: number }[] = body.items;

		if (!Array.isArray(items) || items.length === 0) {
			return NextResponse.json({ error: 'Geen artikelen opgegeven om te boeken.' }, { status: 400 });
		}

		const name = session.user.name || session.user.email || 'XX';
		const initials =
			name
				.split(' ')
				.map((n) => n[0])
				.filter(Boolean)
				.join('')
				.toUpperCase() || 'XX';

		const now = new Date();
		const dateTime = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];

		const filename = `${dateTime}_${initials}.json`;
		const dir = path.join(process.cwd(), 'data', 'stock');

		const payload: Record<string, number> = {};
		for (const item of items) {
			if (item.code) {
				payload[item.code] = (payload[item.code] || 0) + Number(item.quantity || 0);
			}
		}

		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, filename), JSON.stringify(payload, null, 2), 'utf-8');

		return NextResponse.json({
			success: true,
			filename,
			count: items.length,
		});
	} catch (err: any) {
		console.error('Stock Mutation API Error:', err);
		return NextResponse.json({ error: err.message || 'Onbekende fout opgetreden bij het opslaan.' }, { status: 500 });
	}
}
