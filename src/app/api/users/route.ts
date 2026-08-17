/** @format */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Session, getServerSession } from 'next-auth';
import { getRoles } from '@/lib/roles';
import { User, getUsers, writeUser, deleteUser } from '@/lib/users';

import { Role } from '@/types/next-auth';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PRESENCES_PATH = path.join(DATA_DIR, 'presences.json');

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

function getPresenceStatus(presence?: Presence): 'online' | 'idle' | 'offline' {
	if (!presence) {
		return 'offline';
	}

	const age = Date.now() - new Date(presence.lastSeen).getTime();

	if (age > 60_000) {
		return 'offline';
	}

	return presence.idle ? 'idle' : 'online';
}

// ---------- GET ----------
export async function GET() {
	const users = await getUsers();
	const presences = loadPresences();

	const safeUsers = users.map(({ passwordHash, ...user }) => {
		const presence = presences[user.id];

		return {
			...user,

			presence: {
				...presence,
				status: getPresenceStatus(presence),
			},
		};
	});

	return NextResponse.json({
		users: safeUsers,
	});
}

// ---------- POST (CREATE USER) ----------
export async function POST(request: NextRequest) {
	const body = await request.json();
	const { name, email, password, roleId, companyId } = body || {};

	if (!name || !email || !password || !roleId || !companyId) {
		return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
	}

	const users = await getUsers();
	const roles = await getRoles();

	if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
		return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
	}

	const role = roles.find((r) => r.id === roleId);
	if (!role) {
		return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
	}

	const passwordHash = await bcrypt.hash(password, 12);

	const newUser: User = {
		id: `u_${Date.now()}`,
		name,
		email,
		passwordHash,
		roleId,
		companyId,
		permissions: [...role.defaultPermissions],
		theme: 'system',
		preferences: {
			projectPrompts: true,
			defaultView: 'list',
		},
	};

	await writeUser(newUser);

	const safeUsers = (await getUsers()).map(({ passwordHash, ...rest }) => rest);
	return NextResponse.json({ users: safeUsers });
}

// ---------- PATCH (ADMIN EDIT USER) ----------
export async function PATCH(request: NextRequest) {
	const body = await request.json();

	const { id, name, email, companyId, roleId, password, permissions, theme, projects, preferences } = body || {};

	if (!id) {
		return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
	}

	const users = await getUsers();
	const roles = await getRoles();

	const index = users.findIndex((u) => u.id === id);

	if (index === -1) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	if (email) {
		const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== id);

		if (exists) {
			return NextResponse.json(
				{
					error: 'Another user already has this email',
				},
				{ status: 409 }
			);
		}
	}

	if (name) users[index].name = name;
	if (email) users[index].email = email;

	if (companyId) {
		users[index].companyId = companyId;
	}

	if (roleId) {
		const role = roles.find((r) => r.id === roleId);

		if (!role) {
			return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
		}

		users[index].roleId = roleId;

		// Keep permissions in sync with the selected role
		users[index].permissions = [...role.defaultPermissions];

		// Ensure company matches the role
		users[index].companyId = role.companyId;
	}

	if (Array.isArray(permissions)) {
		users[index].permissions = permissions;
	}

	if (Array.isArray(projects)) {
		users[index].projects = projects;
	}

	if (theme && ['light', 'dark', 'system'].includes(theme)) {
		users[index].theme = theme;
	}

	if (preferences) {
		users[index].preferences = {
			...users[index].preferences,
			...preferences,
		};
	}

	if (password) {
		users[index].passwordHash = await bcrypt.hash(password, 12);
	}

	await writeUser(users[index]);

	const safeUsers = users.map(({ passwordHash, ...rest }) => rest);

	return NextResponse.json({
		users: safeUsers,
	});
}

// ---------- PATCH SELF (Theme + Password) ----------
export async function PUT(request: NextRequest) {
	const session = await getServerSession();

	if (!session?.user?.email) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();

	const { theme, currentPassword, newPassword, preferences } = body || {};

	const users = await getUsers();

	const index = users.findIndex((u) => u.email.toLowerCase() === session.user?.email?.toLowerCase());

	if (index === -1) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	if (theme && ['light', 'dark', 'system'].includes(theme)) {
		users[index].theme = theme;
	}

	if (preferences) {
		users[index].preferences = {
			...users[index].preferences,
			...preferences,
		};
	}

	if (newPassword) {
		if (!currentPassword) {
			return NextResponse.json({ error: 'Current password required' }, { status: 400 });
		}

		const valid = await bcrypt.compare(currentPassword, users[index].passwordHash as string);

		if (!valid) {
			return NextResponse.json({ error: 'Current password incorrect' }, { status: 401 });
		}

		users[index].passwordHash = await bcrypt.hash(newPassword, 12);
	}

	await writeUser(users[index]);

	return NextResponse.json({
		success: true,
		user: {
			...users[index],
			passwordHash: undefined,
		},
	});
}

// ---------- DELETE ----------
export async function DELETE(request: NextRequest) {
	const url = new URL(request.url);
	const id = url.searchParams.get('id');

	if (!id) {
		return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
	}

	const users = await getUsers();
	const exists = users.some((u) => u.id === id);

	if (!exists) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	await deleteUser(id);

	const nextUsers = await getUsers();
	const safeUsers = nextUsers.map(({ passwordHash, ...rest }) => rest);
	return NextResponse.json({ users: safeUsers });
}
