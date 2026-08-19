import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'templates.json');

export async function GET() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	if (!fs.existsSync(SETTINGS_PATH)) {
		const defaultSettings = { path: 'data/templates' };
		fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaultSettings, null, 2));
		return NextResponse.json(defaultSettings);
	}

	const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
	return NextResponse.json(JSON.parse(raw));
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		if (!fs.existsSync(DATA_DIR)) {
			fs.mkdirSync(DATA_DIR, { recursive: true });
		}

		fs.writeFileSync(SETTINGS_PATH, JSON.stringify(body, null, 2));

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
	}
}
