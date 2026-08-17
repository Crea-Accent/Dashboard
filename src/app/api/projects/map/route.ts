/** @format */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');

function loadProjectsSettings() {
	const raw = fs.readFileSync(PROJECTS_PATH, 'utf8');
	return JSON.parse(raw);
}

export async function GET() {
	try {
		const settings = loadProjectsSettings();

		const basePath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), settings.path);

		const labels = settings.labels ?? [];

		if (!fs.existsSync(basePath)) {
			return NextResponse.json([]);
		}

		const folders = fs
			.readdirSync(/*turbopackIgnore: true*/ basePath, {
				withFileTypes: true,
			})
			.filter((entry) => entry.isDirectory());

		const projects = folders
			.map((folder) => {
				try {
					const metadataPath = path.join(basePath, folder.name, 'metadata.json');

					if (!fs.existsSync(metadataPath)) {
						return null;
					}

					const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

					const solarPath = path.join(basePath, folder.name, 'solar.json');
					let solar = null;
					if (fs.existsSync(solarPath)) {
						solar = JSON.parse(fs.readFileSync(solarPath, 'utf8'));
					} else if (metadata.solar) {
						// Fallback to legacy metadata.solar if it exists
						solar = metadata.solar;
					}

					const lat = metadata?.address?.lat;
					const lng = metadata?.address?.lng;

					const hasLocation = typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0;

					const label = labels.find((x: any) => x.name === metadata.label);

					return {
						name: folder.name,
						path: `${settings.path}/${folder.name}`,
						type: 'directory',

						label: metadata.label ?? null,
						project: metadata.project ?? null,
						color: label?.color ?? '#6b7280',

						address: metadata.address ?? null,

						updatedAt: metadata.updatedAt ?? fs.statSync(path.join(/*turbopackIgnore: true*/ basePath, folder.name)).mtime.toISOString(),

						contacts: metadata.contacts?.length ?? 0,

						panels: solar?.recommended?.panelsCount ?? solar?.maximum?.panelsCount ?? null,

						yield: solar?.recommended?.yearlyEnergyDcKwh ?? solar?.maximum?.yearlyEnergyDcKwh ?? null,

						hasLocation,
						lat: hasLocation ? lat : null,
						lng: hasLocation ? lng : null,
					};
				} catch (error) {
					console.error(`Failed to load ${folder.name}`, error);
					return null;
				}
			})
			.filter(Boolean);

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
