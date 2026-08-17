/** @format */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'data', 'ticket-templates.json');

function ensureFile() {
	if (!fs.existsSync(path.dirname(FILE_PATH))) {
		fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
	}
	if (!fs.existsSync(FILE_PATH)) {
		fs.writeFileSync(FILE_PATH, JSON.stringify({ templates: [] }, null, 2));
	}
}

function load() {
	ensureFile();
	try {
		return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
	} catch (e) {
		return { templates: [] };
	}
}

function save(data: unknown) {
	ensureFile();
	fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

export async function GET() {
	return NextResponse.json(load());
}

export async function PATCH(req: NextRequest) {
	const body = await req.json();
	const data = load();
	const templates = data.templates || [];

	const index = templates.findIndex((t: any) => t.id === body.id);
	if (index >= 0) {
		templates[index] = body;
	} else {
		templates.push(body);
	}

	data.templates = templates;
	save(data);

	return NextResponse.json(body);
}

export async function DELETE(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const id = searchParams.get('id');

	if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

	const data = load();
	data.templates = (data.templates || []).filter((t: any) => t.id !== id);
	save(data);

	return NextResponse.json({ success: true });
}
