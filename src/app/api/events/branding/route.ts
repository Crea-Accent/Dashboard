import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
	try {
		const formData = await req.formData();
		const file = formData.get('file') as File | null;
		const type = formData.get('type') as string | null;
		const eventId = formData.get('eventId') as string | null;

		if (!file || !type || (type !== 'banner' && type !== 'ribbon') || !eventId) {
			return NextResponse.json({ error: 'Invalid file, type, or missing eventId' }, { status: 400 });
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		const eventDir = path.join(process.cwd(), 'data', 'events', eventId);
		if (!existsSync(eventDir)) {
			mkdirSync(eventDir, { recursive: true });
		}

		// Delete existing files with the same prefix (e.g., banner.png, banner.jpg)
		const files = await fs.readdir(eventDir);
		for (const f of files) {
			if (f.startsWith(`${type}.`)) {
				await fs.unlink(path.join(eventDir, f));
			}
		}

		// Extract extension and save
		const ext = file.name.split('.').pop() || 'png';
		const fileName = `${type}.${ext}`;
		const filePath = path.join(eventDir, fileName);

		await fs.writeFile(filePath, buffer);

		return NextResponse.json({ success: true, fileName });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
	}
}
