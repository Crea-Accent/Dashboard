/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { getArticles } from '@/lib/eandb';
import { getUsers } from '@/lib/users';

function getInitials(name: string) {
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase();
}

export async function GET(req: NextRequest) {
	const session = await getServerSession(authConfig);
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { searchParams } = new URL(req.url);
	const project = searchParams.get('project')?.trim();

	if (!project) {
		return NextResponse.json({ error: 'Missing project parameter' }, { status: 400 });
	}

	const stockDir = path.join(process.cwd(), 'data', 'stock');
	let files: string[] = [];
	try {
		files = await fs.readdir(stockDir);
	} catch {
		// Directory doesn't exist yet
	}

	const jsonFiles = files.filter((f) => f.endsWith('.json')).sort((a, b) => b.localeCompare(a));

	const users = await getUsers();
	const initialsMap: Record<string, string> = {};
	for (const u of users) {
		if (u.name) {
			initialsMap[getInitials(u.name)] = u.name;
		}
	}

	const itemTotals: Record<string, { takenOut: number; returnedIn: number; netQty: number; lastDate: string }> = {};
	const logs: {
		id: string;
		date: string;
		time: string;
		initials: string;
		userName: string;
		note?: string;
		items: { barcode: string; quantity: number }[];
	}[] = [];

	for (const file of jsonFiles) {
		try {
			const raw = await fs.readFile(path.join(stockDir, file), 'utf-8');
			const parsed = JSON.parse(raw);
			const metaProject = typeof parsed?._meta?.project === 'string' ? parsed._meta.project.trim() : '';

			if (metaProject.toLowerCase() !== project.toLowerCase()) continue;

			const id = file.replace('.json', '');
			const [date = '', rawTime = '', initials = '??'] = id.split('_');
			const time = rawTime.replace(/-/g, ':');
			const userName = initialsMap[initials] || initials;

			const logItems: { barcode: string; quantity: number }[] = [];

			for (const [k, v] of Object.entries(parsed)) {
				if (k === '_meta') continue;
				if (typeof v === 'number' && v !== 0) {
					logItems.push({ barcode: k, quantity: v });
					if (!itemTotals[k]) {
						itemTotals[k] = { takenOut: 0, returnedIn: 0, netQty: 0, lastDate: date };
					}
					if (v < 0) {
						itemTotals[k].takenOut += Math.abs(v);
					} else {
						itemTotals[k].returnedIn += v;
					}
					itemTotals[k].netQty += v;
					if (date > itemTotals[k].lastDate) {
						itemTotals[k].lastDate = date;
					}
				}
			}

			logs.push({
				id,
				date,
				time,
				initials,
				userName,
				note: parsed?._meta?.note || undefined,
				items: logItems,
			});
		} catch {}
	}

	const barcodes = Object.keys(itemTotals);
	const articlesMap = barcodes.length > 0 ? await getArticles(barcodes) : {};

	const items = barcodes
		.map((bc) => {
			const art = articlesMap[bc];
			const stat = itemTotals[bc];
			return {
				barcode: bc,
				title: art?.title || bc,
				brand: art?.brand,
				category: art?.category,
				takenOut: stat.takenOut,
				returnedIn: stat.returnedIn,
				netUsed: Math.max(0, stat.takenOut - stat.returnedIn),
				netQty: stat.netQty,
				lastDate: stat.lastDate,
			};
		})
		.sort((a, b) => b.takenOut - a.takenOut);

	const totalTakenOut = items.reduce((s, i) => s + i.takenOut, 0);
	const totalReturnedIn = items.reduce((s, i) => s + i.returnedIn, 0);

	return NextResponse.json({
		project,
		stats: {
			uniqueArticles: items.length,
			totalTakenOut,
			totalReturnedIn,
			bookingsCount: logs.length,
		},
		items,
		logs,
		articlesMap,
	});
}
