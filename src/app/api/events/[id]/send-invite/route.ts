import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getContact } from '@/lib/contacts';
import { render } from '@react-email/render';
import EventInviteEmail from '@/emails/EventInviteEmail';

const eventsDir = path.join(process.cwd(), 'data', 'events');

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const { contactId, testEmail } = await req.json();

		if (!contactId && !testEmail) {
			return NextResponse.json({ error: 'Contact ID or test email is required' }, { status: 400 });
		}

		// 1. Load Event
		const eventPath = path.join(eventsDir, `${id}.json`);
		let event: any;
		try {
			const content = await fs.readFile(eventPath, 'utf8');
			event = JSON.parse(content);
		} catch {
			return NextResponse.json({ error: 'Event not found' }, { status: 404 });
		}

		let contact: any;
		let inviteIndex = -1;

		if (testEmail) {
			contact = { id: 'test-id', name: 'Test Gebruiker', email: testEmail };
		} else {
			// 2. Find Invite entry
			event.invites = event.invites || [];
			inviteIndex = event.invites.findIndex((inv: any) => inv.contactId === contactId);

			if (inviteIndex === -1) {
				return NextResponse.json({ error: 'Contact is not in the invite list for this event' }, { status: 400 });
			}

			// 3. Load Contact to get email
			contact = await getContact(contactId);
			if (!contact) {
				return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
			}
			if (!contact.email) {
				return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 });
			}
		}

		const token = process.env.POSTMARK_API_TOKEN;
		if (!token) {
			return NextResponse.json({ error: 'Postmark API token is not configured' }, { status: 500 });
		}

		const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://crea-accent.app';

		let bannerUrl: string | undefined;
		let ribbonUrl: string | undefined;
		try {
			const publicFiles = await fs.readdir(path.join(process.cwd(), 'public'));
			const bannerFile = publicFiles.find((f) => f.startsWith('banner.'));
			if (bannerFile) bannerUrl = `${baseUrl}/${bannerFile}`;

			const ribbonFile = publicFiles.find((f) => f.startsWith('ribbon.'));
			if (ribbonFile) ribbonUrl = `${baseUrl}/${ribbonFile}`;
		} catch (e) {
			console.error('Failed to read public dir for branding files', e);
		}

		// Generate bulletproof email HTML using react-email
		const emailHtml = await render(EventInviteEmail({ event, contact, baseUrl, bannerUrl, ribbonUrl }));

		// Send email using Postmark
		const response = await fetch('https://api.postmarkapp.com/email', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'X-Postmark-Server-Token': token,
			},
			body: JSON.stringify({
				From: 'events@crea-accent.be',
				To: contact.email,
				Subject: `Uitnodiging: ${event.name}`,
				TextBody: `Uitnodiging voor ${event.name}. Bevestig uw aanwezigheid via deze link: ${baseUrl}/invite/${event.id}/${contact.id}`,
				HtmlBody: emailHtml,
				MessageStream: 'outbound',
			}),
		});

		const postmarkData = await response.json();

		if (!response.ok) {
			console.error('Postmark error:', postmarkData);
			return NextResponse.json(
				{
					error: `Postmark rejected the email: ${postmarkData.Message || 'Unknown error'}`,
					details: postmarkData,
				},
				{ status: response.status }
			);
		}

		// 5. Increment count atomically and save
		if (!testEmail && inviteIndex !== -1) {
			event.invites[inviteIndex].inviteCount = (event.invites[inviteIndex].inviteCount || 0) + 1;
			await fs.writeFile(eventPath, JSON.stringify(event, null, 2));
		}

		return NextResponse.json({ success: true, event });
	} catch (err) {
		console.error('Send invite error:', err);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
