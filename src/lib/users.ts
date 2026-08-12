import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { Session } from 'next-auth';

export type User = Session['user'] & {
	passwordHash?: string;
};

const usersDir = path.join(process.cwd(), 'data', 'users');
const legacyUsersPath = path.join(process.cwd(), 'data', 'users.json');

async function ensureMigrated() {
	if (!existsSync(usersDir)) {
		mkdirSync(usersDir, { recursive: true });
	}

	if (existsSync(legacyUsersPath)) {
		try {
			const file = await fs.readFile(legacyUsersPath, 'utf8');
			const parsed = JSON.parse(file);
			if (Array.isArray(parsed)) {
				for (const user of parsed) {
					if (user && user.id) {
						await fs.writeFile(
							path.join(usersDir, `${user.id}.json`),
							JSON.stringify(user, null, 2),
							'utf8'
						);
					}
				}
			}
			await fs.rename(legacyUsersPath, `${legacyUsersPath}.migrated`);
		} catch (e) {
			console.error('Failed to migrate users.json', e);
		}
	}
}

export async function getUsers(): Promise<User[]> {
	await ensureMigrated();
	try {
		const files = await fs.readdir(usersDir);
		const users: User[] = [];
		for (const file of files) {
			if (file.endsWith('.json')) {
				const content = await fs.readFile(path.join(usersDir, file), 'utf8');
				users.push(JSON.parse(content));
			}
		}
		// Deduplicate users by ID in case of corrupted/duplicate files
		const uniqueUsers = new Map();
		for (const user of users) {
			if (user && user.id) {
				uniqueUsers.set(user.id, user);
			}
		}
		return Array.from(uniqueUsers.values());
	} catch (e) {
		return [];
	}
}

export async function getUser(id: string): Promise<User | null> {
	await ensureMigrated();
	try {
		const content = await fs.readFile(path.join(usersDir, `${id}.json`), 'utf8');
		return JSON.parse(content);
	} catch (e) {
		return null;
	}
}

export async function writeUser(user: User) {
	await ensureMigrated();
	await fs.writeFile(
		path.join(usersDir, `${user.id}.json`),
		JSON.stringify(user, null, 2),
		'utf8'
	);
}

export async function deleteUser(id: string) {
	await ensureMigrated();
	try {
		await fs.unlink(path.join(usersDir, `${id}.json`));
	} catch (e) {}
}
