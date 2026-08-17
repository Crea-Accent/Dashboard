/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'workspace.json');

function ensureFile() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	if (!fs.existsSync(FILE_PATH)) {
		fs.writeFileSync(
			FILE_PATH,
			JSON.stringify(
				{
					path: '',
				},
				null,
				2
			)
		);
	}
}

/* ---------------- GET ---------------- */

export async function GET() {
	try {
		ensureFile();

		const raw = fs.readFileSync(FILE_PATH, 'utf-8');
		const data = JSON.parse(raw);

		return NextResponse.json(data);
	} catch {
		return NextResponse.json({ path: '' }, { status: 200 });
	}
}

/* ---------------- POST ---------------- */

export async function POST(req: NextRequest) {
	try {
		ensureFile();

		const body = await req.json();

		const next = {
			path: body.path || '',
		};

		fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2));

		return NextResponse.json({ success: true });
	} catch {
		return NextResponse.json({ success: false }, { status: 500 });
	}
}
