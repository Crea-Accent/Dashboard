export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getContact } from '@/lib/contacts';

const eventsDir = path.join(process.cwd(), 'data', 'events');

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string; contactId: string }> }) {
	try {
		const { eventId, contactId } = await params;

		const eventPath = path.join(eventsDir, eventId, 'details.json');
		const fallbackPath = path.join(eventsDir, `${eventId}.json`);

		let event: any;
		try {
			const content = await fs.readFile(existsSync(eventPath) ? eventPath : fallbackPath, 'utf8');
			event = JSON.parse(content);
		} catch {
			return NextResponse.json({ error: 'Event not found' }, { status: 404 });
		}

		event.invites = event.invites || [];
		const invite = event.invites.find((inv: any) => inv.contactId === contactId);

		if (!invite) {
			return NextResponse.json({ error: 'Not invited' }, { status: 403 });
		}

		const contact = await getContact(contactId);

		const mailPath = path.join(eventsDir, eventId, 'mail.json');
		const mail = existsSync(mailPath) ? JSON.parse(await fs.readFile(mailPath, 'utf8')) : null;

		const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://crea-accent.app';
		let bannerUrl = null;
		try {
			const eventDir = path.join(eventsDir, eventId);
			let targetDir = existsSync(eventDir) ? eventDir : path.join(process.cwd(), 'public');
			const files = await fs.readdir(targetDir);
			const bannerFile = files.find((f) => f.startsWith('banner.'));
			if (bannerFile) bannerUrl = `${baseUrl}/api/events/${eventId}/image?type=banner`;
		} catch (e) {}

		return NextResponse.json({
			bannerUrl,
			event: {
				name: event.name,
				description: event.description,
				date: event.date,
				confirmationDate: event.confirmationDate,
				time: event.time,
				welcomeTime: event.welcomeTime,
				startTime: event.startTime,
				networkTime: event.networkTime,
				location: event.location,
			},
			mail: mail || null,
			contact: {
				name: contact?.name,
			},
			invite: {
				status: invite.status || 'pending',
				guests: invite.guests || [],
				isVegetarian: invite.isVegetarian || false,
				allergies: invite.allergies || '',
			},
		});
	} catch (err) {
		return NextResponse.json({ error: 'Server error' }, { status: 500 });
	}
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string; contactId: string }> }) {
	try {
		const { eventId, contactId } = await params;
		const { status, guests, isVegetarian, allergies } = await req.json();

		const eventPath = path.join(eventsDir, eventId, 'details.json');
		const fallbackPath = path.join(eventsDir, `${eventId}.json`);
		const targetPath = existsSync(eventPath) ? eventPath : fallbackPath;

		let event: any;
		try {
			const content = await fs.readFile(targetPath, 'utf8');
			event = JSON.parse(content);
		} catch {
			return NextResponse.json({ error: 'Event not found' }, { status: 404 });
		}

		if (event.confirmationDate) {
			const deadline = new Date(`${event.confirmationDate}T23:59:59`);
			if (new Date() > deadline) {
				return NextResponse.json({ error: 'Deadline has passed' }, { status: 403 });
			}
		}

		event.invites = event.invites || [];
		const inviteIndex = event.invites.findIndex((inv: any) => inv.contactId === contactId);

		if (inviteIndex === -1) {
			return NextResponse.json({ error: 'Not invited' }, { status: 403 });
		}

		event.invites[inviteIndex] = {
			...event.invites[inviteIndex],
			status,
			guests: Array.isArray(guests) ? guests.slice(0, 2) : [], // Limit to 2 guests
			isVegetarian: !!isVegetarian,
			allergies: typeof allergies === 'string' ? allergies.trim() : '',
		};

		await fs.writeFile(targetPath, JSON.stringify(event, null, 2));

		return NextResponse.json({ success: true });
	} catch (err) {
		return NextResponse.json({ error: 'Server error' }, { status: 500 });
	}
}
