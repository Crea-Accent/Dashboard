/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const APPS_PATH = path.join(DATA_DIR, 'apps.json');

type AppsSettings = {
	path?: string;
};

function ensureFile() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	if (!fs.existsSync(APPS_PATH)) {
		fs.writeFileSync(APPS_PATH, JSON.stringify({ path: '' }, null, 2));
	}
}

function loadSettings(): AppsSettings {
	ensureFile();
	try {
		return JSON.parse(fs.readFileSync(APPS_PATH, 'utf8'));
	} catch {
		return { path: '' };
	}
}

function saveSettings(settings: AppsSettings) {
	ensureFile();
	fs.writeFileSync(APPS_PATH, JSON.stringify(settings, null, 2));
}

// GET
export async function GET() {
	return NextResponse.json(loadSettings());
}

// POST (overwrite)
export async function POST(request: NextRequest) {
	const body = await request.json();

	const settings: AppsSettings = {
		path: body.path || '',
	};

	saveSettings(settings);

	return NextResponse.json(settings);
}
