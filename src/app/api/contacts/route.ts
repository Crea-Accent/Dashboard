/** @format */

import { Contact, readContacts, writeContact } from '@/lib/contacts';
import { registerCompanySafely } from '@/lib/companies';
import { NextRequest, NextResponse } from 'next/server';

import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
	try {
		const contacts = await readContacts();

		const { searchParams } = new URL(request.url);

		const query = searchParams.get('q')?.trim().toLowerCase();

		if (query) {
			return NextResponse.json(
				contacts.filter((contact) => {
					return (
						contact.name.toLowerCase().includes(query) || contact.email.toLowerCase().includes(query) || contact.phone.toLowerCase().includes(query) || contact.role?.toLowerCase()?.includes(query)
					);
				})
			);
		}

		return NextResponse.json(contacts);
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{
				error: 'Failed to load contacts',
			},
			{
				status: 500,
			}
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		const contact: Contact = {
			id: randomUUID(),
			name: body.name ?? '',
			role: body.role ?? '',
			company: body.company ?? '',
			phone: body.phone ?? '',
			email: body.email ?? '',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await writeContact(contact);
		if (contact.company) {
			await registerCompanySafely(contact.company);
		}

		return NextResponse.json(contact);
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{
				error: 'Failed to create contact',
			},
			{
				status: 500,
			}
		);
	}
}
