/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getArticle, getArticles, saveArticle, getAllCachedArticles, normalizeBarcode, StockArticle } from '@/lib/eandb';

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

		// Single update: { barcode: string, title?: string, brand?: string, min?: number, max?: number }
		if (body.barcode) {
			const existing = await getArticle(body.barcode);
			const parseNum = (val: any) => {
				if (val === null || val === undefined || val === '') return undefined;
				const n = Number(val);
				return isNaN(n) ? undefined : n;
			};

			const updated: StockArticle = {
				...existing,
				barcode: body.barcode,
				title: body.title !== undefined && body.title.trim() ? body.title.trim() : existing.title,
				brand: body.brand !== undefined ? body.brand.trim() || undefined : existing.brand,
				min: body.min !== undefined ? parseNum(body.min) : existing.min,
				max: body.max !== undefined ? parseNum(body.max) : existing.max,
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
