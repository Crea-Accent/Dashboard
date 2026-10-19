'use server';

import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { writeFileAtomic } from '@/lib/eandb';

export async function submitStockMutation(items: { code: string; quantity: number }[], meta?: { project?: string; note?: string }) {
	try {
		const session = await getServerSession(authConfig);
		if (!session || !session.user) {
			return { success: false, error: 'Unauthorized: No active session found.' };
		}

		const name = session.user.name || session.user.email || 'XX';
		const initials = name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase();

		const now = new Date();
		const dateTime = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];

		const filename = `${dateTime}_${initials}.json`;
		const dir = path.join(process.cwd(), 'data', 'stock');

		const payload: Record<string, any> = {};
		const project = meta?.project?.trim();
		const note = meta?.note?.trim();
		if (project || note) {
			payload._meta = {
				...(project ? { project } : {}),
				...(note ? { note } : {}),
			};
		}

		for (const item of items) {
			payload[item.code] = item.quantity;
		}

		await fs.mkdir(dir, { recursive: true });
		await writeFileAtomic(path.join(dir, filename), JSON.stringify(payload, null, 2));

		return { success: true };
	} catch (err: any) {
		console.error('Stock Mutation Error:', err);
		return { success: false, error: err.message || 'Unknown error occurred.' };
	}
}
