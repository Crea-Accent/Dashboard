export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { render } from '@react-email/render';
import EventInviteEmail from '@/emails/EventInviteEmail';

const eventsDir = path.join(process.cwd(), 'data', 'events');

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;

		// 1. Load Event
		const eventPath = path.join(eventsDir, id, 'details.json');
		const fallbackPath = path.join(eventsDir, `${id}.json`);
		let event: any;
		let mail: any = null;
		try {
			const content = await fs.readFile(existsSync(eventPath) ? eventPath : fallbackPath, 'utf8');
			event = JSON.parse(content);

			const mailPath = path.join(eventsDir, id, 'mail.json');
			if (existsSync(mailPath)) {
				mail = JSON.parse(await fs.readFile(mailPath, 'utf8'));
			}
		} catch {
			return new NextResponse('Event not found', { status: 404 });
		}

		// Mock Contact
		const contact = { id: 'preview-id', name: 'John Doe', email: 'john@example.com', company: 'Acme Corp' };
		const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://crea-accent.app';

		let bannerUrl: string | undefined;
		let ribbonUrl: string | undefined;
		try {
			const eventDir = path.join(eventsDir, id);
			let targetDir = existsSync(eventDir) ? eventDir : path.join(process.cwd(), 'public');
			const files = await fs.readdir(targetDir);

			const bannerFile = files.find((f) => f.startsWith('banner.'));
			if (bannerFile) bannerUrl = `${baseUrl}/api/events/${id}/image?type=banner`;

			const ribbonFile = files.find((f) => f.startsWith('ribbon.'));
			if (ribbonFile) ribbonUrl = `${baseUrl}/api/events/${id}/image?type=ribbon`;
		} catch (e) {}

		const emailHtml = // @ts-ignore
			await render(EventInviteEmail({ event, mail, contact, baseUrl, bannerUrl, ribbonUrl, editMode: true }));

		return new NextResponse(emailHtml, {
			headers: { 'Content-Type': 'text/html' },
		});
	} catch (err) {
		console.error('Preview email error:', err);
		return new NextResponse('Internal server error', { status: 500 });
	}
}
