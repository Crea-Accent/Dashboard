/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'files.json');
const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');

type ProjectsConfig = {
	path: string;
	requiredFolders: string[];
};

function loadSettings() {
	if (!fs.existsSync(SETTINGS_PATH)) {
		return { path: '' };
	}

	try {
		return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
	} catch {
		return { path: '' };
	}
}

export function loadProjects(): ProjectsConfig | null {
	try {
		if (!fs.existsSync(PROJECTS_PATH)) {
			return null;
		}

		const raw = fs.readFileSync(PROJECTS_PATH, 'utf-8');
		const parsed = JSON.parse(raw);

		return {
			path: typeof parsed.path === 'string' ? parsed.path : '',
			requiredFolders: Array.isArray(parsed.requiredFolders) ? parsed.requiredFolders.filter((f: unknown) => typeof f === 'string') : [],
		};
	} catch {
		return null;
	}
}

function resolveSafe(targetPath: string, basePath: string) {
	const resolved = path.resolve(targetPath);
	const base = path.resolve(basePath);

	if (!resolved.startsWith(base)) {
		throw new Error('Forbidden path');
	}

	return resolved;
}

function resolveAgainstCorrectRoot(target: string, settingsPath: string, projectsPath?: string) {
	const decoded = decodeURIComponent(target);
	const absolute = path.resolve(decoded);

	if (projectsPath && absolute.startsWith(path.resolve(projectsPath))) {
		return resolveSafe(absolute, projectsPath);
	}

	return resolveSafe(absolute, settingsPath);
}

export async function GET(request: NextRequest) {
	const settings = loadSettings();
	const projects = loadProjects();

	const url = new URL(request.url);
	const rawView = url.searchParams.get('view');
	const ensure = url.searchParams.get('ensure') === '1';
	const recursive = url.searchParams.get('recursive') === '1';

	if (!rawView) {
		return NextResponse.json({ error: 'Missing view parameter' }, { status: 400 });
	}

	if (ensure) {
		try {
			projects?.requiredFolders.map((folder) => {
				fs.mkdirSync(path.join(rawView, folder));
			});
		} catch {}
	}

	let resolved: string;

	try {
		resolved = resolveAgainstCorrectRoot(rawView, settings.path, projects?.path);
	} catch {
		return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
	}

	// ✅ Create required folders + metadata ONLY in project root folder
	if (projects?.path && Array.isArray(projects.requiredFolders)) {
		const projectsRoot = path.resolve(projects.path);
		const current = path.resolve(resolved);

		const relative = path.relative(projectsRoot, current);

		const isProjectRootFolder = relative && !relative.startsWith('..') && !path.isAbsolute(relative) && relative.split(path.sep).length === 1;

		if (isProjectRootFolder) {
			for (const folder of projects.requiredFolders) {
				if (!folder.trim()) continue;

				const folderPath = path.join(current, folder);

				if (!fs.existsSync(folderPath)) {
					fs.mkdirSync(folderPath, { recursive: true });
				}
			}

			const metadataPath = path.join(current, 'metadata.json');

			if (!fs.existsSync(metadataPath)) {
				const defaultMetadata = {
					name: path.basename(current),
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					label: '',
					address: {
						street: '',
						number: '',
						postalCode: '',
						city: '',
						country: 'Belgium',
					},

					contact: {
						contactPersons: [],
						phones: [],
						emails: [],
					},

					logins: {
						company: [],
						client: [],
					},

					notes: '',
				};

				fs.writeFileSync(metadataPath, JSON.stringify(defaultMetadata, null, 2), 'utf-8');
			}
		}
	}

	// 🔥 Recursive reader
	function readRecursive(dir: string) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		let results: Array<Record<string, string | number | null>> = [];

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			let stats: fs.Stats | null = null;
			try {
				stats = fs.statSync(fullPath);
			} catch {
				stats = null;
			}

			results.push({
				path: fullPath,
				name: entry.name,
				type: entry.isDirectory() ? 'directory' : 'file',
				size: entry.isDirectory() ? null : (stats?.size ?? null),
				modified: stats?.mtime ? stats.mtime.toISOString() : null,
			});

			if (recursive && entry.isDirectory()) {
				results = results.concat(readRecursive(fullPath));
			}
		}

		return results;
	}

	let result;

	try {
		result = readRecursive(resolved);
	} catch {
		return NextResponse.json({ error: 'Access denied' }, { status: 403 });
	}

	return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
	const settings = loadSettings();
	const projects = loadProjects();

	const body = await request.json();
	const { path: rawPath } = body || {};

	if (!rawPath) {
		return NextResponse.json({ error: 'Missing path' }, { status: 400 });
	}

	let resolved: string;

	try {
		resolved = resolveAgainstCorrectRoot(rawPath, settings.path, projects?.path);
	} catch {
		return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
	}

	try {
		const stats = fs.statSync(resolved);

		if (stats.isDirectory()) {
			fs.rmSync(resolved, { recursive: true, force: true });
		} else {
			fs.unlinkSync(resolved);
		}

		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest) {
	const settings = loadSettings();
	const projects = loadProjects();

	const body = await request.json();
	const { oldPath, newName, newDir } = body || {};

	if (!oldPath) {
		return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
	}

	let resolvedOld: string;

	try {
		resolvedOld = resolveAgainstCorrectRoot(oldPath, settings.path, projects?.path);
	} catch {
		return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
	}

	let targetPath: string;

	try {
		if (newDir) {
			const resolvedNewDir = resolveAgainstCorrectRoot(newDir, settings.path, projects?.path);
			targetPath = path.join(resolvedNewDir, path.basename(resolvedOld));
		} else if (newName) {
			targetPath = path.join(path.dirname(resolvedOld), newName);
		} else {
			return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
		}

		fs.renameSync(resolvedOld, targetPath);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: 'Move/Rename failed' }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	const settings = loadSettings();
	const projects = loadProjects();

	const contentType = request.headers.get('content-type') || '';

	// ===============================
	// JSON → create folder
	// ===============================
	if (contentType.includes('application/json')) {
		const body = await request.json();
		const { dir, name } = body || {};

		if (!dir || !name) {
			return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
		}

		let resolvedDir: string;

		try {
			resolvedDir = resolveAgainstCorrectRoot(dir, settings.path, projects?.path);
		} catch {
			return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
		}

		const newFolderPath = path.join(resolvedDir, name);

		try {
			if (!fs.existsSync(newFolderPath)) {
				fs.mkdirSync(newFolderPath, { recursive: true });
			}
			return NextResponse.json({ ok: true });
		} catch {
			return NextResponse.json({ error: 'Folder creation failed' }, { status: 500 });
		}
	}

	// ===============================
	// Multipart → upload file
	// ===============================
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const rawDir = formData.get('dir') as string | null;

	if (!file || !rawDir) {
		return NextResponse.json({ error: 'Missing data' }, { status: 400 });
	}

	let dir: string;

	try {
		dir = resolveAgainstCorrectRoot(rawDir, settings.path, projects?.path);
	} catch {
		return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
	}

	const rawRelativePath = formData.get('relativePath') as string | null;
	const buffer = Buffer.from(await file.arrayBuffer());

	let targetDir = dir;
	let targetFileName = file.name;

	if (rawRelativePath) {
		const relativeDir = path.dirname(rawRelativePath);
		
		targetDir = path.join(dir, relativeDir);
		targetFileName = path.basename(rawRelativePath);

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}
	}

	const target = path.join(targetDir, targetFileName);

	try {
		fs.writeFileSync(target, buffer);
		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json({ message: 'Upload failed', error: (error as Error).message }, { status: 500 });
	}
}
