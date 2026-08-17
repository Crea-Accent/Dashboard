/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'data', 'projects.json');

function ensureFile() {
	if (!fs.existsSync(FILE_PATH)) {
		fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2));
	}
}

function load() {
	ensureFile();
	return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
}

function save(data: unknown) {
	ensureFile();
	fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

export async function GET() {
	return NextResponse.json(load());
}

export async function POST(req: NextRequest) {
	const body = await req.json();
	save(body);
	return NextResponse.json(body);
}
