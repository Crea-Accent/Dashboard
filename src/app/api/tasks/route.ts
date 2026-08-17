/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');

/* ================= HELPERS ================= */

function loadProjectsPath(): string {
	const raw = fs.readFileSync(PROJECTS_PATH, 'utf8');
	const parsed = JSON.parse(raw);
	return path.resolve(process.cwd(), parsed.path);
}

function ticketsPath(folder: string) {
	return path.join(folder, 'tickets.json');
}

/* ================= GET ================= */

export async function GET(req: NextRequest) {
	const technicianUsername = req.nextUrl.searchParams.get('technician');

	if (!technicianUsername) {
		return NextResponse.json({ error: 'Missing technician parameter' }, { status: 400 });
	}

	try {
		const base = loadProjectsPath();

		if (!fs.existsSync(base)) {
			return NextResponse.json({ tasks: [] });
		}

		const projects = fs.readdirSync(base, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);

		const allTasks: any[] = [];

		for (const project of projects) {
			const projectFolder = path.join(base, project);
			const ticketsDir = path.join(projectFolder, 'tickets');
			const oldFile = ticketsPath(projectFolder);

			const processTicketPOIs = (ticket: any) => {
				if (ticket.pois && Array.isArray(ticket.pois)) {
					for (const poi of ticket.pois) {
						if (poi.technician === technicianUsername) {
							allTasks.push({
								...poi,
								ticketId: ticket.id,
								projectName: project,
								ticketCreatedAt: ticket.createdAt || ticket.date,
								ticketOpenedBy: ticket.openedBy || ticket.creator,
							});
						}
					}
				}
			};

			// 1. Read from new tickets/ directory structure
			if (fs.existsSync(ticketsDir)) {
				try {
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
								
								processTicketPOIs({ ...metadata, pois });
							}
						}
					}
				} catch (err) {
					console.error(`Error reading tickets directory for project ${project}:`, err);
				}
			}

			// 2. Read from legacy tickets.json (if not migrated yet)
			if (fs.existsSync(oldFile)) {
				try {
					const data = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
					
					if (data.tickets && Array.isArray(data.tickets)) {
						for (const ticket of data.tickets) {
							processTicketPOIs(ticket);
						}
					}
				} catch (err) {
					console.error(`Error reading tickets.json for project ${project}:`, err);
				}
			}
		}

		allTasks.sort((a, b) => {
			if (a.state !== b.state) {
				return a.state === 'unfinished' ? -1 : 1;
			}
			const orderA = typeof a.importance === 'number' ? a.importance : 99;
			const orderB = typeof b.importance === 'number' ? b.importance : 99;
			if (orderA !== orderB) return orderA - orderB;
			
			return new Date(b.ticketCreatedAt).getTime() - new Date(a.ticketCreatedAt).getTime();
		});

		return NextResponse.json({ tasks: allTasks });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
	}
}
