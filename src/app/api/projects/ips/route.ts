import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
	if (!client) return NextResponse.json({ error: 'Missing client' }, { status: 400 });

	try {
		const base = loadProjectsPath();
		const folder = resolveProjectFolder(client, base);
		const file = path.join(folder, 'ips.json');

		if (!fs.existsSync(file)) return NextResponse.json([]);

		const data = JSON.parse(fs.readFileSync(file, 'utf8'));
		return NextResponse.json(data);
	} catch (e) {
		return NextResponse.json({ error: 'Failed to read IPs' }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { client, ips } = body;
		if (!client || !ips) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

		const base = loadProjectsPath();
		const folder = resolveProjectFolder(client, base);
		const file = path.join(folder, 'ips.json');

		fs.writeFileSync(file, JSON.stringify(ips, null, 2));

		return NextResponse.json({ ok: true });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to write IPs' }, { status: 500 });
	}
}
