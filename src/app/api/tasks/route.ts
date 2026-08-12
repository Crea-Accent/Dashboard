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
			const file = ticketsPath(projectFolder);

			if (fs.existsSync(file)) {
				try {
					const data = JSON.parse(fs.readFileSync(file, 'utf8'));
					
					if (data.tickets && Array.isArray(data.tickets)) {
						for (const ticket of data.tickets) {
							if (ticket.pois && Array.isArray(ticket.pois)) {
								for (const poi of ticket.pois) {
									if (poi.technician === technicianUsername) {
										allTasks.push({
											...poi,
											ticketId: ticket.id,
											projectName: project,
											ticketCreatedAt: ticket.createdAt,
											ticketOpenedBy: ticket.openedBy,
										});
									}
								}
							}
						}
					}
				} catch (err) {
					console.error(`Error reading tickets for project ${project}:`, err);
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
