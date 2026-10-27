import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { readVersionedProjectJson, resolveVersionFolder, writeVersionedProjectJson } from '@/lib/duotecnoVersions';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');

function loadProjectsPath(): string {
	const raw = fs.readFileSync(PROJECTS_PATH, 'utf8');
	const parsed = JSON.parse(raw);
	return path.resolve(process.cwd(), parsed.path);
}

function resolveProjectFolder(client: string, base: string) {
	const folder = path.resolve(base, client);
	if (!folder.startsWith(base)) throw new Error('Forbidden');
	return folder;
}

export async function GET(req: NextRequest) {
	const client = req.nextUrl.searchParams.get('client');
	const requestedVersion = req.nextUrl.searchParams.get('version');
	if (!client) return NextResponse.json({ error: 'Missing client' }, { status: 400 });

	try {
		const base = loadProjectsPath();
		const clientDir = resolveProjectFolder(client, base);
		const progDir = path.join(clientDir, 'Programmation');

		const { versions, selectedIndex } = resolveVersionFolder(progDir, requestedVersion);
		const data = readVersionedProjectJson(clientDir, versions, selectedIndex, 'ips.json');

		return NextResponse.json(Array.isArray(data) ? data : []);
	} catch (e) {
		return NextResponse.json({ error: 'Failed to read IPs' }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { client, version, ips } = body;
		if (!client || !ips) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

		const base = loadProjectsPath();
		const clientDir = resolveProjectFolder(client, base);
		const progDir = path.join(clientDir, 'Programmation');

		const { versions, selectedIndex } = resolveVersionFolder(progDir, version);
		writeVersionedProjectJson(clientDir, versions, selectedIndex, 'ips.json', ips, false);

		return NextResponse.json({ ok: true });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to write IPs' }, { status: 500 });
	}
}
