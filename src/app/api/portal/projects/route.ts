/** @format */

import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import path from 'path';

type Metadata = {
	name: string;
	access?: string[];
};

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'projects.json');

type ProjectsSettings = {
	path: string;
};

function loadSettings(): ProjectsSettings {
	if (!fs.existsSync(SETTINGS_PATH)) {
		return {
			path: '',
		};
	}

	try {
		return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
	} catch {
		return {
			path: '',
		};
	}
}

export async function GET() {
	const session = await getServerSession(authConfig);

	if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const settings = loadSettings();

	if (!settings.path) {
		return NextResponse.json({
			projects: [],
		});
	}

	const projectsPath = path.isAbsolute(settings.path) ? settings.path : path.join(process.cwd(), settings.path);

	if (!fs.existsSync(projectsPath)) {
		return NextResponse.json({
			projects: [],
		});
	}

	const projects: string[] = [];

	for (const folder of fs.readdirSync(projectsPath, { withFileTypes: true })) {
		if (!folder.isDirectory()) continue;

		const metadataPath = path.join(projectsPath, folder.name, 'metadata.json');

		if (!fs.existsSync(metadataPath)) continue;

		try {
			const metadata: Metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

			if (metadata.access?.includes(session.user.id)) {
				projects.push(folder.name);
			}
		} catch (err) {
			console.error(`Failed reading ${metadataPath}`, err);
		}
	}

	projects.sort((a, b) => a.localeCompare(b));

	return NextResponse.json({
		projects,
	});
}
