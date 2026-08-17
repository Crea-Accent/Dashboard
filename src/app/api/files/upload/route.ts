/** @format */

import { NextRequest, NextResponse } from 'next/server';

import AdmZip from 'adm-zip';
import { authConfig } from '@/lib/auth';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import os from 'os';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'projects.json');

function loadSettings() {
	if (!fs.existsSync(SETTINGS_PATH)) {
		return { path: '', dateFormat: 'DDMMYYYY' };
	}

	try {
		return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
	} catch {
		return { path: '', dateFormat: 'DDMMYYYY' };
	}
}

function formatDate(format?: string) {
	const d = new Date();
	const DD = String(d.getDate()).padStart(2, '0');
	const MM = String(d.getMonth() + 1).padStart(2, '0');
	const YYYY = d.getFullYear();

	return (format || 'DDMMYYYY').replace('DD', DD).replace('MM', MM).replace('YYYY', String(YYYY));
}

function getInitials(name?: string | null) {
	if (!name) return 'XX';

	return name
		.trim()
		.split(/\s+/)
		.map((p) => p[0]?.toUpperCase() || '')
		.join('');
}

function resolveUniquePath(dir: string, baseName: string, ext = '') {
	let index = 0;

	while (true) {
		const name = index === 0 ? `${baseName}${ext}` : `${baseName}_${index}${ext}`;

		const full = path.join(dir, name);

		if (!fs.existsSync(full)) {
			return full;
		}

		index++;
	}
}

function copyDirectoryRecursive(source: string, destination: string) {
	fs.mkdirSync(destination, { recursive: true });

	const entries = fs.readdirSync(source, { withFileTypes: true });

	for (const entry of entries) {
		const sourcePath = path.join(source, entry.name);
		const destinationPath = path.join(destination, entry.name);

		if (entry.isDirectory()) {
			copyDirectoryRecursive(sourcePath, destinationPath);
			continue;
		}

		fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
		fs.copyFileSync(sourcePath, destinationPath);
	}
}

function removeDirectoryRecursive(target: string) {
	if (!fs.existsSync(target)) return;

	for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
		const entryPath = path.join(target, entry.name);

		if (entry.isDirectory()) {
			removeDirectoryRecursive(entryPath);
			continue;
		}

		fs.unlinkSync(entryPath);
	}

	fs.rmdirSync(target);
}

export async function POST(request: NextRequest) {
	const session = await getServerSession(authConfig);

	if (!session?.user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const settings = loadSettings();

	if (!settings.path) {
		return NextResponse.json({ error: 'No path configured' }, { status: 400 });
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const rawClient = formData.get('client') as string | null;
	const kind = formData.get('kind') as string | null;
	const customName = (formData.get('name') as string | null)?.trim() ?? '';

	const comment = (formData.get('comment') as string | null)?.trim() ?? '';

	const collaborators = formData.getAll('collaborators').map(String).filter(Boolean);

	if (!file || !rawClient || !kind) {
		return NextResponse.json({ error: 'Missing file, client or kind' }, { status: 400 });
	}

	const client = path.basename(decodeURIComponent(rawClient));
	const projectDir = path.join(settings.path, client);
	const targetDir = path.join(projectDir, kind);

	fs.mkdirSync(targetDir, { recursive: true });

	const buffer = Buffer.from(await file.arrayBuffer());
	const stamp = formatDate(settings.dateFormat);

	const uploader = getInitials(session.user.name);

	const ext = path.extname(file.name).toLowerCase();

	const sanitize = (value: string) => value.replace(/[<>:"/\\|?*]/g, '').trim();

	const baseName = [sanitize(customName || path.basename(file.name, ext)), stamp, ...collaborators.map(sanitize), sanitize(uploader), sanitize(comment).replace(/\s+/g, '__')]
		.filter(Boolean)
		.join('__');

	if (kind === 'programmation' && ext === '.zip') {
		const uniquePath = resolveUniquePath(targetDir, baseName);
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-programmation-'));

		try {
			fs.mkdirSync(uniquePath, { recursive: true });

			const zip = new AdmZip(buffer);
			zip.extractAllTo(tempDir, true);

			copyDirectoryRecursive(tempDir, uniquePath);

			return NextResponse.json({
				ok: true,
				savedAs: uniquePath,
				name: path.basename(uniquePath),
				kind,
			});
		} catch (error) {
			console.error('ZIP extraction failed:', error);
			console.error('Temporary extraction folder:', tempDir);
			console.error('Final target folder:', uniquePath);

			return NextResponse.json(
				{
					error: 'Failed to extract ZIP archive',
					details: error instanceof Error ? error.message : String(error),
				},
				{ status: 500 }
			);
		} finally {
			try {
				removeDirectoryRecursive(tempDir);
			} catch (cleanupError) {
				console.error('Failed to remove temp directory:', cleanupError);
			}
		}
	}

	const uniquePath = resolveUniquePath(targetDir, baseName, ext);

	try {
		fs.writeFileSync(uniquePath, buffer);

		return NextResponse.json({
			ok: true,
			savedAs: uniquePath,
			kind,
		});
	} catch (error) {
		console.error('File save failed:', error);
		console.error('Write target:', uniquePath);

		return NextResponse.json(
			{
				error: 'Failed to save file',
				details: error instanceof Error ? error.message : String(error),
				target: uniquePath,
			},
			{ status: 500 }
		);
	}
}
