/** @format */

import { NextRequest, NextResponse } from 'next/server';

import { authConfig } from '@/lib/auth';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'projects.json');

type ProjectSettings = {
	path: string;
};

type Metadata = {
	name: string;
	access?: string[];
	[key: string]: any;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const session = await getServerSession(authConfig);

	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!fs.existsSync(SETTINGS_PATH)) {
		return NextResponse.json({ error: 'Projects settings not found' }, { status: 500 });
	}

	const settings: ProjectSettings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));

	if (!settings.path) {
		return NextResponse.json({ error: 'Projects path not configured' }, { status: 500 });
	}

	const projectsPath = path.isAbsolute(settings.path) ? settings.path : path.join(process.cwd(), settings.path);

	const { id } = await params;

	const metadataPath = path.join(projectsPath, id, 'metadata.json');

	if (!fs.existsSync(metadataPath)) {
		return NextResponse.json({ error: 'Project not found' }, { status: 404 });
	}

	try {
		const metadata: Metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

		const allowed = (metadata.access?.includes(session.user.id) || session.user.permissions?.includes('projects.read')) ?? false;

		if (!allowed) {
			return NextResponse.json(
				{
					allowed: false,
				},
				{ status: 403 }
			);
		}

		return NextResponse.json({
			allowed: true,
			project: metadata,
		});
	} catch (err) {
		console.error(err);

		return NextResponse.json(
			{
				error: 'Failed to read project metadata',
			},
			{ status: 500 }
		);
	}
}
