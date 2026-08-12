/** @format */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function loadProjectsSettings() {
	const DATA_DIR = path.join(process.cwd(), 'data');
	const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');
	const raw = fs.readFileSync(PROJECTS_PATH, 'utf8');
	return JSON.parse(raw);
}

export async function GET(request: NextRequest) {
	try {
		const client = request.nextUrl.searchParams.get('client');
		if (!client) return NextResponse.json({ error: 'Missing client' }, { status: 400 });

		const settings = loadProjectsSettings();
		const canbusPath = path.resolve(process.cwd(), settings.path, client, 'canbus.json');

		if (fs.existsSync(canbusPath)) {
			const data = JSON.parse(fs.readFileSync(canbusPath, 'utf8'));
			return NextResponse.json(data);
		}

		// Fallback to metadata.json's setup if it exists for backwards compatibility
		const metadataPath = path.resolve(process.cwd(), settings.path, client, 'metadata.json');
		if (fs.existsSync(metadataPath)) {
			const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
			if (metadata.setup) return NextResponse.json({ setup: metadata.setup });
		}

		return NextResponse.json({ setup: [] });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to load canbus data' }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const { client, data } = await request.json();
		if (!client || !data) return NextResponse.json({ error: 'Missing client or data' }, { status: 400 });

		const settings = loadProjectsSettings();
		const canbusPath = path.resolve(process.cwd(), settings.path, client, 'canbus.json');

		fs.writeFileSync(canbusPath, JSON.stringify(data, null, '\t'));

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to save canbus data' }, { status: 500 });
	}
}
