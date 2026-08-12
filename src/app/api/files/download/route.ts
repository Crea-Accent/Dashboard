/** @format */

import { NextRequest, NextResponse } from 'next/server';

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const rawPath = url.searchParams.get('path');
	const asZip = url.searchParams.get('zip') === 'true';

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

	const stats = fs.statSync(targetPath);

	// ---------- CASE 1: DOWNLOAD A SINGLE FILE ----------
	if (stats.isFile() && !asZip) {
		const fileName = path.basename(targetPath);
		const fileBuffer = fs.readFileSync(targetPath);

		return new NextResponse(fileBuffer, {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Disposition': `attachment; filename="${fileName}"`,
			},
		});
	}

	// ---------- CASE 2: ZIP A FOLDER ON THE FLY ----------
	if (stats.isDirectory()) {
		const zip = new AdmZip();
		zip.addLocalFolder(targetPath);

		const buffer = zip.toBuffer();
		const folderName = path.basename(targetPath);

		return new NextResponse(buffer as never, {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${folderName}.zip"`,
			},
		});
	}

	return NextResponse.json({ error: 'Unsupported path type' }, { status: 400 });
}
