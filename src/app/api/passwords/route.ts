/** @format */

import { NextRequest, NextResponse } from 'next/server';

import crypto from 'crypto';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PASSWORDS_PATH = path.join(DATA_DIR, 'passwords.json');
import { getUsers, User } from '@/lib/users';

const SECRET = crypto
	.createHash('sha256')
	.update(process.env.NEXTAUTH_SECRET || 'dev-secret')
	.digest();

type Password = {
	id: string;
	label: string;
	username?: string;
	password: string; // encrypted
	tags?: string[];
	link?: string;

	ownerId: string;
	users: string[];

	createdAt: string;
	updatedAt: string;
};

function encrypt(text: string) {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv('aes-256-gcm', SECRET, iv);

	const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();

	return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(data: string) {
	const buf = Buffer.from(data, 'base64');

	const iv = buf.subarray(0, 16);
	const tag = buf.subarray(16, 32);
	const text = buf.subarray(32);

	const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET, iv);
	decipher.setAuthTag(tag);

	const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);

	return decrypted.toString();
}

function ensureFiles() {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

	if (!fs.existsSync(PASSWORDS_PATH)) {
		fs.writeFileSync(PASSWORDS_PATH, JSON.stringify([], null, 2));
	}
}

function loadPasswords(): Password[] {
	ensureFiles();
	return JSON.parse(fs.readFileSync(PASSWORDS_PATH, 'utf8'));
}

function savePasswords(passwords: Password[]) {
	fs.writeFileSync(PASSWORDS_PATH, JSON.stringify(passwords, null, 2));
}

function generateId() {
	return `pw_${Date.now()}`;
}

function isAdmin(user: User) {
	return user?.permissions?.includes('admin.read') ?? false;
}

async function getCurrentUser() {
	const session = await getServerSession();

	if (!session?.user?.email) return null;

	const users = await getUsers();

	return users.find((u) => u.email.toLowerCase() === session.user.email?.toLowerCase()) ?? null;
}

/* ---------------- GET ---------------- */

export async function GET(req: NextRequest) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const url = new URL(req.url);
	const id = url.searchParams.get('id');

	const passwords = loadPasswords();

	if (id) {
		const pw = passwords.find((p) => p.id === id);

		if (!pw) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		const allowed = pw.ownerId === user.id || pw.users.includes(user.id) || isAdmin(user);

		if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

		return NextResponse.json({
			password: {
				...pw,
				password: decrypt(pw.password),
			},
		});
	}

	if (isAdmin(user)) {
		return NextResponse.json({ passwords });
	}

	const visible = passwords.filter((p) => p.ownerId === user.id || p.users.includes(user.id));

	return NextResponse.json({ passwords: visible });
}

/* ---------------- CREATE ---------------- */

export async function POST(req: NextRequest) {
	const user = await getCurrentUser();

	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const body = await req.json();

	const passwords = loadPasswords();

	const now = new Date().toISOString();

	const password: Password = {
		id: generateId(),
		label: body.label,
		username: body.username ?? '',
		password: encrypt(body.password),
		tags: body.tags ?? [],
		link: body.link ?? '',
		ownerId: user.id,
		users: body.users ?? [],
		createdAt: now,
		updatedAt: now,
	};

	passwords.push(password);

	savePasswords(passwords);

	return NextResponse.json({ password });
}

/* ---------------- UPDATE ---------------- */

export async function PATCH(req: NextRequest) {
	const user = await getCurrentUser();

	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const body = await req.json();

	const passwords = loadPasswords();

	const index = passwords.findIndex((p) => p.id === body.id);

	if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

	const existing = passwords[index];

	const allowed = existing.ownerId === user.id || isAdmin(user);

	if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	passwords[index] = {
		...existing,
		label: body.label ?? existing.label,
		username: body.username ?? existing.username,
		password: body.password ? encrypt(body.password) : existing.password,
		tags: body.tags ?? existing.tags,
		link: body.link ?? existing.link,
		users: body.users ?? existing.users,
		updatedAt: new Date().toISOString(),
	};

	savePasswords(passwords);

	return NextResponse.json({ password: passwords[index] });
}

/* ---------------- DELETE ---------------- */

export async function DELETE(req: NextRequest) {
	const user = await getCurrentUser();

	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const url = new URL(req.url);
	const id = url.searchParams.get('id');

	const passwords = loadPasswords();

	const pw = passwords.find((p) => p.id === id);

	if (!pw) return NextResponse.json({ error: 'Not found' }, { status: 404 });

	if (pw.ownerId !== user.id && !isAdmin(user)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	savePasswords(passwords.filter((p) => p.id !== id));

	return NextResponse.json({ success: true });
}
