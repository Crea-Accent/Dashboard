/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { writeFileAtomic } from '@/lib/eandb';

function getInitials(name: string) {
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase();
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
	const session = await getServerSession(authConfig);
	const permissions = session?.user?.permissions || [];
	const hasWrite = permissions.includes('stock.write') || permissions.includes('admin.write');

	if (!hasWrite) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { id } = await props.params;
		const safeId = path.basename(id);
		const filePath = path.join(process.cwd(), 'data', 'stock', `${safeId}.json`);

		await fs.unlink(filePath);
		revalidatePath('/dashboard/stock');
		revalidatePath('/dashboard/stock/logs');
		revalidatePath('/dashboard/stock/overview');

		return NextResponse.json({ success: true });
	} catch (err: any) {
		return NextResponse.json({ error: err.message || 'Failed to delete log' }, { status: 500 });
	}
}

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
	const session = await getServerSession(authConfig);
	const permissions = session?.user?.permissions || [];
	const hasWrite = permissions.includes('stock.write') || permissions.includes('admin.write');

	if (!hasWrite) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { id } = await props.params;
		const safeId = path.basename(id);
		const stockDir = path.join(process.cwd(), 'data', 'stock');
		const sourceFile = path.join(stockDir, `${safeId}.json`);

		const raw = await fs.readFile(sourceFile, 'utf-8');
		const parsed = JSON.parse(raw);

		const reversedPayload: Record<string, any> = {};
		for (const [k, v] of Object.entries(parsed)) {
			if (k === '_meta') continue;
			if (typeof v === 'number' && v !== 0) {
				reversedPayload[k] = -v;
			}
		}

		reversedPayload._meta = {
			project: parsed._meta?.project || undefined,
			note: `Reverted booking ${safeId}`,
		};

		const userName = session?.user?.name || 'Unknown User';
		const initials = getInitials(userName);
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0];
		const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
		const newId = `${dateStr}_${timeStr}_${initials}`;
		const newFile = path.join(stockDir, `${newId}.json`);

		await writeFileAtomic(newFile, JSON.stringify(reversedPayload, null, 2));

		revalidatePath('/dashboard/stock');
		revalidatePath('/dashboard/stock/logs');
		revalidatePath('/dashboard/stock/overview');

		return NextResponse.json({ success: true, newId });
	} catch (err: any) {
		return NextResponse.json({ error: err.message || 'Failed to revert log' }, { status: 500 });
	}
}
