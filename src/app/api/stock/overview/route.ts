/** @format */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getArticles, getAllCachedArticles } from '@/lib/eandb';

export async function GET() {
	const session = await getServerSession(authConfig);
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const dir = path.join(process.cwd(), 'data', 'stock');
	const totals: Record<string, number> = {};
	const lastMutatedMap: Record<string, string> = {};

	if (existsSync(dir)) {
		try {
			const files = await fs.readdir(dir);
			const logFiles = files.filter((f) => f.endsWith('.json')).sort();

			for (const file of logFiles) {
				try {
					const content = await fs.readFile(path.join(dir, file), 'utf-8');
					const payload: Record<string, number> = JSON.parse(content);
					const datePart = file.split('_')[0] || '';

					for (const [code, qty] of Object.entries(payload)) {
						if (typeof qty === 'number') {
							totals[code] = (totals[code] || 0) + qty;
							if (datePart) lastMutatedMap[code] = datePart;
						}
					}
				} catch (err) {
					console.error(`Failed to parse stock log ${file}:`, err);
				}
			}
		} catch (err) {
			console.error('Failed to read stock directory:', err);
		}
	}

	const cachedArticles = await getAllCachedArticles();
	const allBarcodes = Array.from(new Set([...Object.keys(totals), ...Object.keys(cachedArticles)]));
	const articleDetails = await getArticles(allBarcodes);

	const items = allBarcodes.map((code) => {
		const detail = articleDetails[code];
		const quantity = totals[code] || 0;
		const min = detail?.min;
		const max = detail?.max;
		const needsOrder = min !== undefined && min > 0 && quantity < min;
		const target = max !== undefined && max > (min || 0) ? max : min || 0;
		const orderQty = needsOrder ? Math.max(1, target - quantity) : 0;

		return {
			barcode: code,
			title: detail?.title || code,
			brand: detail?.brand,
			category: detail?.category,
			image: detail?.image,
			min,
			max,
			quantity,
			needsOrder,
			orderQty,
			lastMutated: lastMutatedMap[code],
		};
	});

	// Sort items: items needing order first, then positive stock, then alphabetically
	items.sort((a, b) => {
		if (a.needsOrder && !b.needsOrder) return -1;
		if (!a.needsOrder && b.needsOrder) return 1;
		if (b.quantity !== a.quantity) return b.quantity - a.quantity;
		return a.title.localeCompare(b.title);
	});

	const stats = {
		totalArticles: items.length,
		totalItems: items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
		positiveStock: items.filter((i) => i.quantity > 0).length,
		negativeStock: items.filter((i) => i.quantity < 0).length,
		zeroStock: items.filter((i) => i.quantity === 0).length,
		needsOrder: items.filter((i) => i.needsOrder).length,
	};

	return NextResponse.json({ items, stats });
}
