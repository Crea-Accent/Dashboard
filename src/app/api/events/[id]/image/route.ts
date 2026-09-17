import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const eventsDir = path.join(process.cwd(), 'data', 'events');

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const { searchParams } = new URL(req.url);
		const type = searchParams.get('type'); // 'banner' or 'ribbon'

		if (!type || (type !== 'banner' && type !== 'ribbon')) {
			return new NextResponse('Invalid type', { status: 400 });
		}

		const eventDir = path.join(eventsDir, id);

		if (!existsSync(eventDir)) {
			// Fallback to old public dir just in case
			const publicDir = path.join(process.cwd(), 'public');
			const files = await fs.readdir(publicDir);
			const file = files.find((f) => f.startsWith(`${type}.`));
			if (file) {
				const buffer = await fs.readFile(path.join(publicDir, file));
				const ext = file.split('.').pop();
				return new NextResponse(buffer, {
					headers: { 'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}` },
				});
			}
			return new NextResponse('Not found', { status: 404 });
		}

		const files = await fs.readdir(eventDir);
		const file = files.find((f) => f.startsWith(`${type}.`));

		if (!file) {
			// Fallback to public
			const publicDir = path.join(process.cwd(), 'public');
			const pubFiles = await fs.readdir(publicDir);
			const pubFile = pubFiles.find((f) => f.startsWith(`${type}.`));
			if (pubFile) {
				const buffer = await fs.readFile(path.join(publicDir, pubFile));
				const ext = pubFile.split('.').pop();
				return new NextResponse(buffer, {
					headers: { 'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}` },
				});
			}
			return new NextResponse('Not found', { status: 404 });
		}

		const buffer = await fs.readFile(path.join(eventDir, file));
		const ext = file.split('.').pop();
		return new NextResponse(buffer, {
			headers: { 'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}` },
		});
	} catch (err) {
		return new NextResponse('Internal Error', { status: 500 });
	}
}
