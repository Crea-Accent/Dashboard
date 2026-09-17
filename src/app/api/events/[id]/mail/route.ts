import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const eventsDir = path.join(process.cwd(), 'data', 'events');

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;

		const mailPath = path.join(eventsDir, id, 'mail.json');
		if (existsSync(mailPath)) {
			const content = await fs.readFile(mailPath, 'utf8');
			return NextResponse.json(JSON.parse(content));
		}

		// Fallback to defaults from details.json
		const eventPath = path.join(eventsDir, id, 'details.json');
		const fallbackEventPath = path.join(eventsDir, `${id}.json`);
		const targetPath = existsSync(eventPath) ? eventPath : fallbackEventPath;

		if (existsSync(targetPath)) {
			const content = await fs.readFile(targetPath, 'utf8');
			const event = JSON.parse(content);
			return NextResponse.json({
				title: event.name || '',
				description: event.description || '',
				greeting: 'Hallo {name}, u bent uitgenodigd!',
			});
		}

		return NextResponse.json({ error: 'Event not found' }, { status: 404 });
	} catch (err) {
		console.error('Error fetching mail config:', err);
		return NextResponse.json({ error: 'Server error' }, { status: 500 });
	}
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const body = await req.json();

		const eventDir = path.join(eventsDir, id);
		if (!existsSync(eventDir)) {
			await fs.mkdir(eventDir, { recursive: true });
		}

		const mailPath = path.join(eventDir, 'mail.json');
		await fs.writeFile(mailPath, JSON.stringify(body, null, 2));

		return NextResponse.json({ success: true });
	} catch (err) {
		console.error('Error saving mail config:', err);
		return NextResponse.json({ error: 'Server error' }, { status: 500 });
	}
}
