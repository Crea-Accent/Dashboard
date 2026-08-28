import { NextResponse } from 'next/server';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');

async function loadProjectsSettings() {
	const raw = await fsp.readFile(PROJECTS_PATH, 'utf8');
	return JSON.parse(raw);
}

// In-memory cache
let cachedProjects: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function GET() {
	try {
		if (cachedProjects && Date.now() - cacheTimestamp < CACHE_TTL) {
			return NextResponse.json(cachedProjects);
		}

		const settings = await loadProjectsSettings();
		const basePath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), settings.path);
		const labels = settings.labels ?? [];

		try {
			await fsp.access(basePath);
		} catch {
			return NextResponse.json([]);
		}

		const entries = await fsp.readdir(/*turbopackIgnore: true*/ basePath, {
			withFileTypes: true,
		});
		const folders = entries.filter((entry) => entry.isDirectory());

		const projectPromises = folders.map(async (folder) => {
			try {
				const metadataPath = path.join(basePath, folder.name, 'metadata.json');

				let metadataRaw;
				try {
					metadataRaw = await fsp.readFile(metadataPath, 'utf8');
				} catch {
					return null;
				}

				const metadata = JSON.parse(metadataRaw);

				const solarPath = path.join(basePath, folder.name, 'solar.json');
				let solar = null;
				try {
					const solarRaw = await fsp.readFile(solarPath, 'utf8');
					solar = JSON.parse(solarRaw);
				} catch {
					if (metadata.solar) {
						solar = metadata.solar;
					}
				}

				const lat = metadata?.address?.lat;
				const lng = metadata?.address?.lng;
				const hasLocation = typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0;

				const label = labels.find((x: any) => x.name === metadata.label);

				const hasFusionSolar = !!solar?.stationCode;

				let hasCanbusSetup = false;
				let hasCanbusSim = false;
				const canbusPath = path.join(basePath, folder.name, 'canbus.json');
				try {
					const canbusData = JSON.parse(await fsp.readFile(canbusPath, 'utf8'));
					hasCanbusSetup = Array.isArray(canbusData.setup) && canbusData.setup.length > 0;
					hasCanbusSim = Array.isArray(canbusData.sim) && canbusData.sim.length > 0;
				} catch {
					if (metadata.setup || metadata.sim) {
						hasCanbusSetup = Array.isArray(metadata.setup) && metadata.setup.length > 0;
						hasCanbusSim = Array.isArray(metadata.sim) && metadata.sim.length > 0;
					}
				}

				let hasOpenTickets = false;
				let hasNeedsOrdering = false;
				let hasOrdered = false;
				let hasInStock = false;

				const processPOI = (poi: any) => {
					if (poi.state === 'canceled') return;

					if (poi.state && poi.state !== 'finished') {
						hasOpenTickets = true;
					}
					if (poi.requiresMaterials) {
						const mState = poi.materialState || 'needs_ordering';
						if (mState === 'needs_ordering') hasNeedsOrdering = true;
						if (mState === 'ordered') hasOrdered = true;
						if (mState === 'in_stock') hasInStock = true;
					}
				};

				const ticketsDir = path.join(basePath, folder.name, 'tickets');
				try {
					const dirs = await fsp.readdir(ticketsDir, { withFileTypes: true });

					const ticketPromises = dirs.map(async (d) => {
						if (d.isDirectory()) {
							const ticketFolder = path.join(ticketsDir, d.name);
							const files = await fsp.readdir(ticketFolder);
							const poiPromises = files.map(async (f) => {
								if (f.startsWith('poi_') && f.endsWith('.json')) {
									const poi = JSON.parse(await fsp.readFile(path.join(ticketFolder, f), 'utf8'));
									processPOI(poi);
								}
							});
							await Promise.all(poiPromises);
						}
					});
					await Promise.all(ticketPromises);
				} catch {
					// Check legacy tickets.json
					const oldTicketsFile = path.join(basePath, folder.name, 'tickets.json');
					try {
						const ticketsData = JSON.parse(await fsp.readFile(oldTicketsFile, 'utf8'));
						if (ticketsData.tickets && Array.isArray(ticketsData.tickets)) {
							for (const t of ticketsData.tickets) {
								if (t.pois && Array.isArray(t.pois)) {
									for (const p of t.pois) {
										processPOI(p);
									}
								}
							}
						}
					} catch {}
				}

				let updatedAt = metadata.updatedAt;
				if (!updatedAt) {
					const stat = await fsp.stat(path.join(/*turbopackIgnore: true*/ basePath, folder.name));
					updatedAt = stat.mtime.toISOString();
				}

				return {
					name: folder.name,
					path: `${settings.path}/${folder.name}`,
					type: 'directory',

					label: metadata.label ?? null,
					project: metadata.project ?? null,
					contractor: metadata.contractor ?? null,
					architect: metadata.architect ?? null,
					color: label?.color ?? '#6b7280',

					address: metadata.address ?? null,

					updatedAt,

					contacts: metadata.contacts?.length ?? 0,

					panels: solar?.recommended?.panelsCount ?? solar?.maximum?.panelsCount ?? null,

					yield: solar?.recommended?.yearlyEnergyDcKwh ?? solar?.maximum?.yearlyEnergyDcKwh ?? null,

					hasLocation,
					lat: hasLocation ? lat : null,
					lng: hasLocation ? lng : null,

					hasFusionSolar,
					hasCanbusSetup,
					hasCanbusSim,
					hasOpenTickets,
					hasNeedsOrdering,
					hasMaterialsReady: hasOrdered || hasInStock,
				};
			} catch (error) {
				console.error(`Failed to load ${folder.name}`, error);
				return null;
			}
		});

		const projects = (await Promise.all(projectPromises)).filter(Boolean);

		cachedProjects = projects;
		cacheTimestamp = Date.now();

		return NextResponse.json(projects);
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{
				error: 'Failed to load project map data',
			},
			{
				status: 500,
			}
		);
	}
}
