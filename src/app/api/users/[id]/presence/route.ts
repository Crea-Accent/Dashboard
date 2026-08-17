/** @format */

import { NextRequest, NextResponse } from 'next/server';

import { Session } from 'next-auth';
import { getUsers } from '@/lib/users';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PRESENCES_PATH = path.join(DATA_DIR, 'presences.json');

type User = Session['user'];

type Presence = {
	lastSeen: string;
	page?: string;
	project?: string;
	idle: boolean;
};

type Presences = Record<string, Presence>;

function ensureFiles() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	if (!fs.existsSync(PRESENCES_PATH)) {
		fs.writeFileSync(PRESENCES_PATH, '{}');
	}
}

function loadPresences(): Presences {
	ensureFiles();

	try {
		return JSON.parse(fs.readFileSync(PRESENCES_PATH, 'utf8'));
	} catch {
		fs.writeFileSync(PRESENCES_PATH, '{}');

		return {};
	}
}

function savePresences(presences: Presences) {
	ensureFiles();

	try {
		fs.writeFileSync(PRESENCES_PATH, JSON.stringify(presences, null, 2));
	} catch {}
}

// ---------- GET ----------

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const users = await getUsers();
	const presences = loadPresences();

	const user = users.find((u) => u.id === id);

	if (!user) {
		return NextResponse.json(
			{
				error: 'User not found',
			},
			{ status: 404 }
		);
	}

	const presence = presences[id] ?? null;

	return NextResponse.json({
		user: {
			...user,
			passwordHash: undefined,
		},
		presence,
	});
}

// ---------- POST (Heartbeat) ----------

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const users = await getUsers();

	const user = users.find((u) => u.id === id);

	if (!user) {
		return NextResponse.json(
			{
				error: 'User not found',
			},
			{ status: 404 }
		);
	}

	const body = await request.json().catch(() => {});

	const presences = loadPresences();

	presences[id] = {
		lastSeen: new Date().toISOString(),
		page: body?.page || null,
		project: body?.project || null,
		idle: body?.idle ?? false,
	};

	savePresences(presences);

	return NextResponse.json({});
}
