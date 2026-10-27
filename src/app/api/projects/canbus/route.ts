/** @format */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { readVersionedProjectJson, resolveVersionFolder, writeVersionedProjectJson } from '@/lib/duotecnoVersions';

function loadProjectsSettings() {
	const DATA_DIR = path.join(process.cwd(), 'data');
	const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');
	const raw = fs.readFileSync(PROJECTS_PATH, 'utf8');
	return JSON.parse(raw);
}

export async function GET(request: NextRequest) {
	try {
		const client = request.nextUrl.searchParams.get('client');
		const requestedVersion = request.nextUrl.searchParams.get('version');
		if (!client) return NextResponse.json({ error: 'Missing client' }, { status: 400 });

		const settings = loadProjectsSettings();
		const clientDir = path.resolve(process.cwd(), settings.path, client);
		const progDir = path.join(clientDir, 'Programmation');

		const { versions, selectedIndex } = resolveVersionFolder(progDir, requestedVersion);
		const canbusData = readVersionedProjectJson(clientDir, versions, selectedIndex, 'canbus.json');

		if (canbusData) {
			return NextResponse.json(canbusData);
		}

		// Fallback to metadata.json's setup if it exists for backwards compatibility
		const metadataPath = path.join(clientDir, 'metadata.json');
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
		const { client, version, data } = await request.json();
		if (!client || !data) return NextResponse.json({ error: 'Missing client or data' }, { status: 400 });

		const settings = loadProjectsSettings();
		const clientDir = path.resolve(process.cwd(), settings.path, client);
		const progDir = path.join(clientDir, 'Programmation');

		const { versions, selectedIndex } = resolveVersionFolder(progDir, version);
		writeVersionedProjectJson(clientDir, versions, selectedIndex, 'canbus.json', data, true);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to save canbus data' }, { status: 500 });
	}
}
