/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'files.json');

function ensure() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	if (!fs.existsSync(SETTINGS_PATH)) {
		fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ path: '' }, null, 2));
	}
}

function load() {
	ensure();
	return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
}

function save(data: Record<string, string>) {
	ensure();
	fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

export async function GET() {
	return NextResponse.json(load());
}

export async function POST(req: NextRequest) {
	const body = await req.json();
	save(body);
	return NextResponse.json(load());
}
