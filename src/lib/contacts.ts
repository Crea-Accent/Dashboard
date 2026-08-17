/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const legacyContactsPath = path.join(process.cwd(), 'data', 'contacts.json');
const contactsDir = path.join(process.cwd(), 'data', 'contacts');

export type Contact = {
	id: string;
	name: string;
	role: string;
	company?: string;
	phone: string;
	email: string;
	createdAt: string;
	updatedAt: string;
};

// Ensure dir exists
if (!existsSync(contactsDir)) {
	mkdirSync(contactsDir, { recursive: true });
}

export async function ensureMigrated() {
	if (existsSync(legacyContactsPath)) {
		try {
			const file = await fs.readFile(legacyContactsPath, 'utf8');
			const contacts = JSON.parse(file) as Contact[];
			for (const c of contacts) {
				await fs.writeFile(path.join(contactsDir, `${c.id}.json`), JSON.stringify(c, null, 2), 'utf8');
			}
			await fs.rename(legacyContactsPath, legacyContactsPath + '.bak');
		} catch (e) {
			console.error('Migration error', e);
		}
	}
}

export async function readContacts(): Promise<Contact[]> {
	await ensureMigrated();
	try {
		const files = await fs.readdir(contactsDir);
		const jsonFiles = files.filter((f) => f.endsWith('.json'));
		const contacts: Contact[] = [];
		for (const file of jsonFiles) {
			try {
				const content = await fs.readFile(path.join(contactsDir, file), 'utf8');
				contacts.push(JSON.parse(content));
			} catch (err) {}
		}
		return contacts;
	} catch {
		return [];
	}
}

export async function getContact(id: string): Promise<Contact | null> {
	await ensureMigrated();
	try {
		const content = await fs.readFile(path.join(contactsDir, `${id}.json`), 'utf8');
		return JSON.parse(content);
	} catch {
		return null;
	}
}

export async function writeContact(contact: Contact) {
	await ensureMigrated();
	await fs.writeFile(path.join(contactsDir, `${contact.id}.json`), JSON.stringify(contact, null, 2), 'utf8');
}

export async function deleteContact(id: string) {
	await ensureMigrated();
	try {
		await fs.unlink(path.join(contactsDir, `${id}.json`));
	} catch (e) {}
}
