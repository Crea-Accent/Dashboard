/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getArticle, getArticles, saveArticle, saveCachedArticles, getAllCachedArticles, normalizeBarcode, StockArticle } from '@/lib/eandb';

export async function GET(req: NextRequest) {
	const session = await getServerSession(authConfig);
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const barcode = req.nextUrl.searchParams.get('barcode');
	if (!barcode) {
		return NextResponse.json({ error: 'Barcode parameter is required' }, { status: 400 });
	}

	const cleanCode = normalizeBarcode(barcode);
	const cached = await getAllCachedArticles();
	const isFirstTime = !cached[cleanCode];

	const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
	const article = await getArticle(cleanCode, { forceRefresh });

	return NextResponse.json({ article, isFirstTime });
}

export async function POST(req: NextRequest) {
	const session = await getServerSession(authConfig);
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await req.json();

		// Batch query: { barcodes: string[] }
		if (Array.isArray(body.barcodes)) {
			const articles = await getArticles(body.barcodes);
			return NextResponse.json({ articles });
		}

		// Batch mark as ordered: { markOrdered: { barcode: string, orderedQty: number }[] }
		if (Array.isArray(body.markOrdered)) {
			const cache = await getAllCachedArticles();
			const nowIso = new Date().toISOString();

			for (const entry of body.markOrdered) {
				if (!entry?.barcode) continue;
				const code = normalizeBarcode(String(entry.barcode));
				const existing = cache[code] || {
					barcode: code,
					title: code,
					updatedAt: nowIso,
				};
				const qty = Number(entry.orderedQty || 0);
				cache[code] = {
					...existing,
					orderedQty: qty > 0 ? qty : undefined,
					orderedAt: qty > 0 ? nowIso : undefined,
					updatedAt: nowIso,
				};
			}

			await saveCachedArticles(cache);
			return NextResponse.json({ success: true });
		}

		// Single update: { barcode: string, title?: string, brand?: string, min?: number, max?: number, orderedQty?: number | null }
		if (body.barcode) {
			const existing = await getArticle(body.barcode);
			const parseNum = (val: any) => {
				if (val === null || val === undefined || val === '') return undefined;
				const n = Number(val);
				return isNaN(n) ? undefined : n;
			};

			let nextOrderedQty = existing.orderedQty;
			let nextOrderedAt = existing.orderedAt;
			if (body.orderedQty !== undefined) {
				const parsedOrder = parseNum(body.orderedQty);
				if (parsedOrder && parsedOrder > 0) {
					nextOrderedQty = parsedOrder;
					nextOrderedAt = new Date().toISOString();
				} else {
					nextOrderedQty = undefined;
					nextOrderedAt = undefined;
				}
			}

			const updated: StockArticle = {
				...existing,
				barcode: body.barcode,
				title: body.title !== undefined && body.title.trim() ? body.title.trim() : existing.title,
				brand: body.brand !== undefined ? body.brand.trim() || undefined : existing.brand,
				min: body.min !== undefined ? parseNum(body.min) : existing.min,
				max: body.max !== undefined ? parseNum(body.max) : existing.max,
				orderedQty: nextOrderedQty,
				orderedAt: nextOrderedAt,
				notFound: false,
				isCustom: true,
				updatedAt: new Date().toISOString(),
			};
			await saveArticle(updated);
			return NextResponse.json({ success: true, article: updated });
		}

		return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
	} catch (err: any) {
		console.error('Error in /api/stock/articles:', err);
		return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
	}
}
