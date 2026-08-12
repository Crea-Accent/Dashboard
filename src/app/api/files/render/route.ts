/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
	const url = new URL(request.url);

	const rawPath = url.searchParams.get('path');

	if (!rawPath) {
		return NextResponse.json({ error: 'Missing path' }, { status: 400 });
	}

	let targetPath = decodeURIComponent(rawPath);

	if (!path.isAbsolute(targetPath)) {
		const settingsPath = path.join(process.cwd(), 'data', 'projects.json');
		if (fs.existsSync(settingsPath)) {
			try {
				const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
				if (settings.path) {
					targetPath = path.join(settings.path, targetPath);
				}
			} catch (e) {
				console.error('Failed to parse projects.json', e);
			}
		}
	}

	if (!fs.existsSync(targetPath)) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 });
	}

	const fileBuffer = fs.readFileSync(targetPath);

	const extension = path.extname(targetPath).toLowerCase();

	const mimeTypes: Record<string, string> = {
		'.pdf': 'application/pdf',
		'.txt': 'application/txt',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.webp': 'image/webp',
		'.gif': 'image/gif',
	};

	const fileName = path.basename(targetPath);

	return new NextResponse(fileBuffer, {
		headers: {
			'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',

			'Content-Disposition': `inline; filename="${fileName}"`,
		},
	});
}
