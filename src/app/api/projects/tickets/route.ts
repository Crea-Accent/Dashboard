/** @format */

import { NextRequest, NextResponse } from 'next/server';

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');

/* ================= HELPERS ================= */

function loadProjectsPath(): string {
	const raw = fs.readFileSync(PROJECTS_PATH, 'utf8');
	const parsed = JSON.parse(raw);
	return path.resolve(/*turbopackIgnore: true*/ process.cwd(), parsed.path);
}

function resolveProjectFolder(client: string, base: string) {
	const folder = path.resolve(base, client);
	if (!folder.startsWith(base)) throw new Error('Forbidden');
	return folder;
}

function migrateOldTickets(folder: string) {
	const oldFile = path.join(folder, 'tickets.json');
	const newDir = path.join(folder, 'tickets');

	if (fs.existsSync(oldFile)) {
		try {
			const data = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
			if (data.tickets && Array.isArray(data.tickets)) {
				if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

				for (const ticket of data.tickets) {
					const ticketFolder = path.join(newDir, ticket.id);
					if (!fs.existsSync(ticketFolder)) fs.mkdirSync(ticketFolder, { recursive: true });

					const { pois, ...metadata } = ticket;
					fs.writeFileSync(path.join(ticketFolder, 'ticket.json'), JSON.stringify(metadata, null, 2));

					if (Array.isArray(pois)) {
						pois.forEach((poi: any, index: number) => {
							const importance = poi.importance || index + 1;

							// Move images if they exist in the root tickets directory
							const moveImage = (imagePathKey: string) => {
								if (poi[imagePathKey] && poi[imagePathKey].includes('/tickets/')) {
									const fileName = poi[imagePathKey].split('/').pop();
									if (fileName) {
										const oldImgPath = path.join(folder, 'tickets', fileName);
										const newImgPath = path.join(ticketFolder, fileName);
										if (fs.existsSync(oldImgPath)) {
											fs.renameSync(oldImgPath, newImgPath);
										}
										// update path
										poi[imagePathKey] = poi[imagePathKey].replace(`/tickets/${fileName}`, `/tickets/${ticket.id}/${fileName}`);
									}
								}
							};

							moveImage('imagePath');
							moveImage('finishedImagePath');
							fs.writeFileSync(path.join(ticketFolder, `poi_${importance}_${poi.id}.json`), JSON.stringify(poi, null, 2));
						});
					}
				}
			}
			fs.renameSync(oldFile, path.join(folder, 'tickets.json.bak'));
		} catch (error) {
			console.error('Failed to migrate tickets', error);
		}
	}
}

/* ================= GET ================= */

export async function GET(req: NextRequest) {
	const client = req.nextUrl.searchParams.get('client');
	if (!client) return NextResponse.json({ error: 'Missing client parameter' }, { status: 400 });

	try {
		const base = loadProjectsPath();
		const folder = resolveProjectFolder(client, base);

		migrateOldTickets(folder);

		const ticketsDir = path.join(folder, 'tickets');
		if (!fs.existsSync(ticketsDir)) {
			return NextResponse.json({ tickets: [] });
		}

		const tickets = [];
		const dirs = fs.readdirSync(ticketsDir, { withFileTypes: true });

		for (const d of dirs) {
			if (d.isDirectory()) {
				const ticketFolder = path.join(ticketsDir, d.name);
				const ticketFile = path.join(ticketFolder, 'ticket.json');

				if (fs.existsSync(ticketFile)) {
					const metadata = JSON.parse(fs.readFileSync(ticketFile, 'utf8'));
					const pois: any[] = [];

					const files = fs.readdirSync(ticketFolder);
					for (const f of files) {
						if (f.startsWith('poi_') && f.endsWith('.json')) {
							pois.push(JSON.parse(fs.readFileSync(path.join(ticketFolder, f), 'utf8')));
						}
					}

					pois.sort((a, b) => (a.importance || 99) - (b.importance || 99));

					tickets.push({
						...metadata,
						pois,
					});
				}
			}
		}

		// Sort tickets by creation date descending
		tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		return NextResponse.json({ tickets });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
	}
}

/* ================= POST ================= */

export async function POST(req: NextRequest) {
	const body = await req.json();
	const { client, ticket } = body;

	if (!client || !ticket) {
		return NextResponse.json({ error: 'Missing client or ticket' }, { status: 400 });
	}

	try {
		const base = loadProjectsPath();
		const folder = resolveProjectFolder(client, base);
		const ticketsDir = path.join(folder, 'tickets');

		const newTicket = {
			...ticket,
			id: ticket.id || crypto.randomUUID(),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const ticketFolder = path.join(ticketsDir, newTicket.id);
		if (!fs.existsSync(ticketFolder)) fs.mkdirSync(ticketFolder, { recursive: true });

		const { pois, ...metadata } = newTicket;
		fs.writeFileSync(path.join(ticketFolder, 'ticket.json'), JSON.stringify(metadata, null, 2));

		if (Array.isArray(pois)) {
			pois.forEach((poi: any, index: number) => {
				const poiData = {
					...poi,
					id: poi.id || crypto.randomUUID(),
					state: poi.state || 'unfinished',
					importance: poi.importance || index + 1,
				};
				fs.writeFileSync(path.join(ticketFolder, `poi_${poiData.importance}_${poiData.id}.json`), JSON.stringify(poiData, null, 2));
			});
		}

		return NextResponse.json({ ok: true, ticket: newTicket });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to save ticket' }, { status: 500 });
	}
}

/* ================= PATCH ================= */

export async function PATCH(req: NextRequest) {
	const body = await req.json();
	const { client, ticketId, updates } = body;

	if (!client || !ticketId || !updates) {
		return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
	}

	try {
		const base = loadProjectsPath();
		const folder = resolveProjectFolder(client, base);
		const ticketFolder = path.join(folder, 'tickets', ticketId);

		if (!fs.existsSync(ticketFolder) || !fs.existsSync(path.join(ticketFolder, 'ticket.json'))) {
			return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
		}

		const metadata = JSON.parse(fs.readFileSync(path.join(ticketFolder, 'ticket.json'), 'utf8'));

		const { pois, ...otherUpdates } = updates;

		const updatedMetadata = {
			...metadata,
			...otherUpdates,
			updatedAt: new Date().toISOString(),
		};
		fs.writeFileSync(path.join(ticketFolder, 'ticket.json'), JSON.stringify(updatedMetadata, null, 2));

		if (pois && Array.isArray(pois)) {
			const files = fs.readdirSync(ticketFolder);
			for (const f of files) {
				if (f.startsWith('poi_') && f.endsWith('.json')) {
					fs.unlinkSync(path.join(ticketFolder, f));
				}
			}

			pois.forEach((poi: any, index: number) => {
				const importance = poi.importance || index + 1;
				fs.writeFileSync(path.join(ticketFolder, `poi_${importance}_${poi.id}.json`), JSON.stringify(poi, null, 2));
			});
		}

		const resultingPOIs: any[] = [];
		const newFiles = fs.readdirSync(ticketFolder);
		for (const f of newFiles) {
			if (f.startsWith('poi_') && f.endsWith('.json')) {
				resultingPOIs.push(JSON.parse(fs.readFileSync(path.join(ticketFolder, f), 'utf8')));
			}
		}
		resultingPOIs.sort((a, b) => (a.importance || 99) - (b.importance || 99));

		return NextResponse.json({
			ok: true,
			ticket: { ...updatedMetadata, pois: resultingPOIs },
		});
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
	}
}
