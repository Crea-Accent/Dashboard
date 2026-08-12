import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const rolesDir = path.join(process.cwd(), 'data', 'roles');
const legacyRolesPath = path.join(process.cwd(), 'data', 'roles.json');

export type Role = {
	id: string;
	companyId: string;
	name: string;
	defaultPermissions: string[];
};

async function ensureMigrated() {
	if (!existsSync(rolesDir)) {
		mkdirSync(rolesDir, { recursive: true });
	}

	if (existsSync(legacyRolesPath)) {
		try {
			const file = await fs.readFile(legacyRolesPath, 'utf8');
			const parsed = JSON.parse(file);
			if (Array.isArray(parsed)) {
				for (const role of parsed) {
					if (role && role.id) {
						await fs.writeFile(
							path.join(rolesDir, `${role.id}.json`),
							JSON.stringify(role, null, 2),
							'utf8'
						);
					}
				}
			}
			await fs.rename(legacyRolesPath, `${legacyRolesPath}.migrated`);
		} catch (e) {
			console.error('Failed to migrate roles.json', e);
		}
	}
}

export async function getRoles(): Promise<Role[]> {
	await ensureMigrated();
	try {
		const files = await fs.readdir(rolesDir);
		const roles: Role[] = [];
		for (const file of files) {
			if (file.endsWith('.json')) {
				try {
					const content = await fs.readFile(path.join(rolesDir, file), 'utf8');
					roles.push(JSON.parse(content));
				} catch (e) {
					// Ignore invalid JSON files
				}
			}
		}
		// Deduplicate roles by ID in case of corrupted/duplicate files
		const uniqueRoles = new Map();
		for (const role of roles) {
			if (role && role.id) {
				uniqueRoles.set(role.id, role);
			}
		}
		return Array.from(uniqueRoles.values());
	} catch (e) {
		return [];
	}
}

export async function getRole(id: string): Promise<Role | null> {
	await ensureMigrated();
	try {
		const content = await fs.readFile(path.join(rolesDir, `${id}.json`), 'utf8');
		return JSON.parse(content);
	} catch (e) {
		return null;
	}
}

export async function writeRole(role: Role) {
	await ensureMigrated();
	await fs.writeFile(
		path.join(rolesDir, `${role.id}.json`),
		JSON.stringify(role, null, 2),
		'utf8'
	);
}

export async function deleteRole(id: string) {
	await ensureMigrated();
	try {
		await fs.unlink(path.join(rolesDir, `${id}.json`));
	} catch (e) {}
}
