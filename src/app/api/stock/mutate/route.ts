/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { getAllCachedArticles, normalizeBarcode, saveCachedArticles, writeFileAtomic } from '@/lib/eandb';

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authConfig);
		if (!session || !session.user) {
			return NextResponse.json({ error: 'Unauthorized: No active session found.' }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		const items: { code: string; quantity: number }[] = body.items;
		const project: string | undefined = typeof body.project === 'string' && body.project.trim() ? body.project.trim() : undefined;
		const note: string | undefined = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : undefined;

		if (!Array.isArray(items) || items.length === 0) {
			return NextResponse.json({ error: 'No items specified to book.' }, { status: 400 });
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

		const payload: Record<string, any> = {};
		if (project || note) {
			payload._meta = {
				...(project ? { project } : {}),
				...(note ? { note } : {}),
			};
		}

		for (const item of items) {
			if (item.code) {
				payload[item.code] = (payload[item.code] || 0) + Number(item.quantity || 0);
			}
		}

		await fs.mkdir(dir, { recursive: true });
		await writeFileAtomic(path.join(dir, filename), JSON.stringify(payload, null, 2));

		// If positive stock is booked for articles that had orderedQty, reduce/clear orderedQty
		try {
			const cache = await getAllCachedArticles();
			let cacheModified = false;
			for (const item of items) {
				const qty = Number(item.quantity || 0);
				if (qty > 0 && item.code) {
					const clean = normalizeBarcode(item.code);
					const cachedArt = cache[clean];
					if (cachedArt && cachedArt.orderedQty && cachedArt.orderedQty > 0) {
						const remaining = cachedArt.orderedQty - qty;
						cachedArt.orderedQty = remaining > 0 ? remaining : undefined;
						if (!cachedArt.orderedQty) cachedArt.orderedAt = undefined;
						cacheModified = true;
					}
				}
			}
			if (cacheModified) {
				await saveCachedArticles(cache);
			}
		} catch (e) {
			console.error('Failed to update orderedQty after mutation:', e);
		}

		return NextResponse.json({
			success: true,
			filename,
			count: items.length,
		});
	} catch (err: any) {
		console.error('Stock Mutation API Error:', err);
		return NextResponse.json({ error: err.message || 'An unknown error occurred while saving.' }, { status: 500 });
	}
}
