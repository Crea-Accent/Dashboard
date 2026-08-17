/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import { loadProjects } from '../route';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'files.json');

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

	const rawPath = request.nextUrl.searchParams.get('path');

	if (!rawPath) {
		return NextResponse.json(
			{
				error: 'Missing path',
			},
			{
				status: 400,
			}
		);
	}

	let resolved: string;

	try {
		resolved = resolveAgainstCorrectRoot(rawPath, settings.path, projects?.path);
	} catch {
		return NextResponse.json(
			{
				error: 'Forbidden path',
			},
			{
				status: 403,
			}
		);
	}

	try {
		const content = fs.readFileSync(resolved, 'utf8');

		return new NextResponse(content, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: 'Failed to read file',
				details: error instanceof Error ? error.message : String(error),
			},
			{
				status: 500,
			}
		);
	}
}
