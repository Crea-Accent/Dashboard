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
	// Migrate from original single events.json (very old)
	if (existsSync(legacyEventsPath)) {
		try {
			const file = await fs.readFile(legacyEventsPath, 'utf8');
			const data = JSON.parse(file);
			for (const event of data.events || []) {
				const eventFolder = path.join(eventsDir, event.id);
				if (!existsSync(eventFolder)) mkdirSync(eventFolder, { recursive: true });
				await fs.writeFile(path.join(eventFolder, `details.json`), JSON.stringify(event, null, 2));
			}
			await fs.rename(legacyEventsPath, legacyEventsPath + '.bak');
		} catch (e) {
			console.error('Migration from legacy events.json failed', e);
		}
	}

	// Migrate from flat .json files to folders
	try {
		const files = await fs.readdir(eventsDir, { withFileTypes: true });
		for (const dirent of files) {
			if (dirent.isFile() && dirent.name.endsWith('.json')) {
				const id = dirent.name.replace('.json', '');
				const eventFolder = path.join(eventsDir, id);
				const oldPath = path.join(eventsDir, dirent.name);

				if (!existsSync(eventFolder)) mkdirSync(eventFolder, { recursive: true });

				// Move the file to eventFolder/details.json
				const content = await fs.readFile(oldPath, 'utf8');
				await fs.writeFile(path.join(eventFolder, 'details.json'), content);
				await fs.unlink(oldPath);
			}
		}
	} catch (e) {
		console.error('Migration from flat JSON to folders failed', e);
	}
}

export async function GET() {
	await ensureMigrated();
	try {
		const files = await fs.readdir(eventsDir, { withFileTypes: true });
		const eventFolders = files.filter((f) => f.isDirectory() && f.name !== 'branding' && f.name !== '[id]');
		const events = [];
		for (const folder of eventFolders) {
			try {
				const content = await fs.readFile(path.join(eventsDir, folder.name, 'details.json'), 'utf8');
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

		const eventFolder = path.join(eventsDir, event.id);
		if (!existsSync(eventFolder)) {
			mkdirSync(eventFolder, { recursive: true });
		}

		await fs.writeFile(path.join(eventFolder, `details.json`), JSON.stringify(event, null, 2));

		// Find the most recent event to inherit its mail.json
		try {
			const files = await fs.readdir(eventsDir, { withFileTypes: true });
			const eventFolders = files.filter((f) => f.isDirectory() && f.name !== 'branding' && f.name !== '[id]' && f.name !== event.id);

			let mostRecentEvent = null;
			let mostRecentDate = 0;
			let mostRecentFolder = null;

			for (const folder of eventFolders) {
				try {
					const content = await fs.readFile(path.join(eventsDir, folder.name, 'details.json'), 'utf8');
					const evt = JSON.parse(content);
					if (evt.createdAt) {
						const d = new Date(evt.createdAt).getTime();
						if (d > mostRecentDate) {
							mostRecentDate = d;
							mostRecentEvent = evt;
							mostRecentFolder = folder.name;
						}
					}
				} catch (e) {}
			}

			if (mostRecentFolder) {
				const lastEventDir = path.join(eventsDir, mostRecentFolder);
				const lastMailPath = path.join(lastEventDir, 'mail.json');
				if (existsSync(lastMailPath)) {
					const newMailPath = path.join(eventFolder, 'mail.json');
					await fs.copyFile(lastMailPath, newMailPath);
				}

				// Also inherit images
				const files = await fs.readdir(lastEventDir);
				for (const file of files) {
					if (file.startsWith('banner.') || file.startsWith('ribbon.')) {
						await fs.copyFile(path.join(lastEventDir, file), path.join(eventFolder, file));
					}
				}
			}
		} catch (e) {
			console.error('Failed to copy previous mail config', e);
		}

		return NextResponse.json({ success: true, event });
	} catch (err) {
		return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
	}
}
