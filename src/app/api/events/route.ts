import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const eventsDir = path.join(process.cwd(), 'data', 'events');
const legacyEventsPath = path.join(process.cwd(), 'data', 'events.json');

if (!existsSync(eventsDir)) {
	mkdirSync(eventsDir, { recursive: true });
}

async function ensureMigrated() {
	if (existsSync(legacyEventsPath)) {
		try {
			const file = await fs.readFile(legacyEventsPath, 'utf8');
			const data = JSON.parse(file);
			for (const event of data.events || []) {
				await fs.writeFile(path.join(eventsDir, `${event.id}.json`), JSON.stringify(event, null, 2));
			}
			await fs.rename(legacyEventsPath, legacyEventsPath + '.bak');
		} catch (e) {}
	}
}

export async function GET() {
	await ensureMigrated();
	try {
		const files = await fs.readdir(eventsDir);
		const jsonFiles = files.filter((f) => f.endsWith('.json'));
		const events = [];
		for (const file of jsonFiles) {
			try {
				const content = await fs.readFile(path.join(eventsDir, file), 'utf8');
				events.push(JSON.parse(content));
			} catch (e) {}
		}
		return NextResponse.json({ events });
	} catch (err) {
		return NextResponse.json({ events: [] });
	}
}

export async function POST(req: Request) {
	await ensureMigrated();
	try {
		const { event } = await req.json();

		event.id = event.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
		event.createdAt = event.createdAt || new Date().toISOString();
		event.invites = event.invites || [];

		await fs.writeFile(path.join(eventsDir, `${event.id}.json`), JSON.stringify(event, null, 2));

		return NextResponse.json({ success: true, event });
	} catch (err) {
		return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
	}
}
