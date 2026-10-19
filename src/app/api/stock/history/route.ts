/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getArticle, normalizeBarcode, StockArticle } from '@/lib/eandb';
import { getUsers } from '@/lib/users';

export type ArticleMutationRecord = {
	id: string;
	file: string;
	logId: string;
	date: string;
	time: string;
	formattedDate: string;
	initials: string;
	userName: string;
	quantity: number;
	type: 'in' | 'out';
	balanceAfter: number;
	project?: string;
	note?: string;
};

export type ArticleDailyStat = {
	date: string;
	formattedDate: string;
	inQty: number;
	outQty: number;
	netQty: number;
	balance: number;
	mutations: number;
};

export type ArticleHistoryResponse = {
	barcode: string;
	article: StockArticle;
	summary: {
		totalIn: number;
		totalOut: number;
		currentStock: number;
		mutationCount: number;
		firstMutated?: string;
		lastMutated?: string;
	};
	daily: ArticleDailyStat[];
	mutations: ArticleMutationRecord[];
};

function formatDisplayDate(dateStr: string, timeStr?: string) {
	try {
		const [year, month, day] = dateStr.split('-');
		if (!year || !month || !day) return dateStr;
		const d = new Date(Number(year), Number(month) - 1, Number(day));
		const formatted = d.toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
		if (timeStr) {
			return `${formatted} at ${timeStr.slice(0, 5)}`;
		}
		return formatted;
	} catch {
		return dateStr;
	}
}

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
	const article = await getArticle(cleanCode);

	const users = await getUsers();
	const userInitialsMap: Record<string, string> = {};
	for (const u of users) {
		if (u.name) {
			const inits = u.name
				.split(' ')
				.map((n) => n[0])
				.filter(Boolean)
				.join('')
				.toUpperCase();
			userInitialsMap[inits] = u.name;
		}
	}

	const dir = path.join(process.cwd(), 'data', 'stock');
	const mutations: ArticleMutationRecord[] = [];
	let runningBalance = 0;

	if (existsSync(dir)) {
		try {
			const rawFiles = await fs.readdir(dir);
			const logFiles = rawFiles.filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b));

			for (const file of logFiles) {
				try {
					const content = await fs.readFile(path.join(dir, file), 'utf-8');
					const payload: Record<string, any> = JSON.parse(content);

					// Check if our barcode is present
					let foundQty: number | null = null;
					for (const [codeKey, qty] of Object.entries(payload)) {
						if (codeKey !== '_meta' && normalizeBarcode(codeKey) === cleanCode && typeof qty === 'number') {
							foundQty = (foundQty || 0) + qty;
						}
					}

					if (foundQty !== null && foundQty !== 0) {
						const basename = file.replace('.json', '');
						const parts = basename.split('_');
						const date = parts[0] || '';
						const time = (parts[1] || '').replace(/-/g, ':');
						const initials = parts[2] || '??';
						const userName = userInitialsMap[initials] || initials;

						runningBalance += foundQty;

						mutations.push({
							id: file,
							file,
							logId: basename,
							date,
							time,
							formattedDate: formatDisplayDate(date, time),
							initials,
							userName,
							quantity: foundQty,
							type: foundQty >= 0 ? 'in' : 'out',
							balanceAfter: runningBalance,
							project: payload._meta?.project,
							note: payload._meta?.note,
						});
					}
				} catch (err) {
					console.error(`Error reading stock log ${file}:`, err);
				}
			}
		} catch (err) {
			console.error('Error reading stock directory:', err);
		}
	}

	// Daily aggregation
	const dailyMap: Record<string, ArticleDailyStat> = {};
	for (const m of mutations) {
		if (!dailyMap[m.date]) {
			dailyMap[m.date] = {
				date: m.date,
				formattedDate: formatDisplayDate(m.date),
				inQty: 0,
				outQty: 0,
				netQty: 0,
				balance: m.balanceAfter,
				mutations: 0,
			};
		}
		if (m.quantity > 0) {
			dailyMap[m.date].inQty += m.quantity;
		} else {
			dailyMap[m.date].outQty += Math.abs(m.quantity);
		}
		dailyMap[m.date].netQty += m.quantity;
		dailyMap[m.date].balance = m.balanceAfter;
		dailyMap[m.date].mutations += 1;
	}

	const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

	const totalIn = mutations.filter((m) => m.quantity > 0).reduce((acc, m) => acc + m.quantity, 0);
	const totalOut = mutations.filter((m) => m.quantity < 0).reduce((acc, m) => acc + Math.abs(m.quantity), 0);

	const summary = {
		totalIn,
		totalOut,
		currentStock: runningBalance,
		mutationCount: mutations.length,
		firstMutated: mutations.length > 0 ? mutations[0].formattedDate : undefined,
		lastMutated: mutations.length > 0 ? mutations[mutations.length - 1].formattedDate : undefined,
	};

	// Return recent mutations first
	const timeline = [...mutations].reverse();

	return NextResponse.json({
		barcode: cleanCode,
		article,
		summary,
		daily,
		mutations: timeline,
	});
}
