import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { readContacts } from '@/lib/contacts';

const eventsDir = path.join(process.cwd(), 'data', 'events');

async function syncPostmarkTracking(event: any): Promise<boolean> {
	const token = process.env.POSTMARK_API_TOKEN;
	if (!token || !Array.isArray(event?.invites)) return false;
	const hasSentInvites = event.invites.some((inv: any) => (inv.inviteCount || 0) > 0);
	if (!hasSentInvites) return false;

	try {
		const headers = {
			Accept: 'application/json',
			'X-Postmark-Server-Token': token,
		};

		const [opensRes, clicksRes, contacts] = await Promise.all([
			fetch('https://api.postmarkapp.com/messages/outbound/opens?count=500&offset=0', { headers, cache: 'no-store' }),
			fetch('https://api.postmarkapp.com/messages/outbound/clicks?count=500&offset=0', { headers, cache: 'no-store' }),
			readContacts(),
		]);

		const opensData = opensRes.ok ? await opensRes.json() : { Opens: [] };
		const clicksData = clicksRes.ok ? await clicksRes.json() : { Clicks: [] };
		const opens: any[] = Array.isArray(opensData?.Opens) ? opensData.Opens : [];
		const clicks: any[] = Array.isArray(clicksData?.Clicks) ? clicksData.Clicks : [];

		const emailByContactId = new Map<string, string>();
		for (const c of contacts) {
			if (c?.id && c?.email) {
				emailByContactId.set(String(c.id), String(c.email).trim().toLowerCase());
			}
		}

		let dirty = false;
		const eventIdStr = String(event.id);

		for (const inv of event.invites) {
			if ((inv.inviteCount || 0) <= 0) continue;

			const contactIdStr = String(inv.contactId);
			const email = emailByContactId.get(contactIdStr);
			const msgIds = new Set<string>([...(Array.isArray(inv.messageIds) ? inv.messageIds : []), ...(inv.lastMessageId ? [inv.lastMessageId] : [])]);

			const matchedOpens = opens.filter((o) => {
				if (o.MessageID && msgIds.has(o.MessageID)) return true;
				if (o.Tag && String(o.Tag) !== eventIdStr) return false;
				if (
					email &&
					String(o.Recipient || '')
						.trim()
						.toLowerCase() === email
				)
					return true;
				return false;
			});

			const matchedClicks = clicks.filter((c) => {
				if (c.MessageID && msgIds.has(c.MessageID)) return true;
				if (typeof c.OriginalLink === 'string' && c.OriginalLink.includes(`/invite/${eventIdStr}/${contactIdStr}`)) return true;
				if (c.Tag && String(c.Tag) !== eventIdStr) return false;
				if (
					email &&
					String(c.Recipient || '')
						.trim()
						.toLowerCase() === email
				)
					return true;
				return false;
			});

			const latestOpenAt = matchedOpens.reduce<string | undefined>((latest, o) => {
				if (!o.ReceivedAt) return latest;
				return !latest || new Date(o.ReceivedAt) > new Date(latest) ? o.ReceivedAt : latest;
			}, inv.openedAt);

			const latestClickAt = matchedClicks.reduce<string | undefined>((latest, c) => {
				if (!c.ReceivedAt) return latest;
				return !latest || new Date(c.ReceivedAt) > new Date(latest) ? c.ReceivedAt : latest;
			}, inv.clickedAt);

			const nextOpened = matchedOpens.length > 0 || matchedClicks.length > 0 || Boolean(inv.opened);
			const nextOpenCount = Math.max(matchedOpens.length, inv.openCount || 0, nextOpened ? 1 : 0);
			const nextOpenedAt = latestOpenAt || latestClickAt || inv.openedAt;

			if (inv.opened !== nextOpened || inv.openCount !== nextOpenCount || inv.openedAt !== nextOpenedAt || inv.clickedAt !== latestClickAt) {
				inv.opened = nextOpened;
				inv.openCount = nextOpenCount;
				if (nextOpenedAt) inv.openedAt = nextOpenedAt;
				if (latestClickAt) inv.clickedAt = latestClickAt;
				dirty = true;
			}
		}

		return dirty;
	} catch {
		return false;
	}
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		let eventPath = path.join(eventsDir, id, 'details.json');
		if (!existsSync(eventPath)) {
			eventPath = path.join(eventsDir, `${id}.json`);
		}
		const content = await fs.readFile(eventPath, 'utf8');
		const event = JSON.parse(content);

		const updated = await syncPostmarkTracking(event);
		if (updated) {
			await fs.writeFile(eventPath, JSON.stringify(event, null, 2));
		}

		return NextResponse.json({ event });
	} catch (e) {
		return NextResponse.json({ error: 'Event not found' }, { status: 404 });
	}
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const { updates } = await req.json();

		let eventPath = path.join(eventsDir, id, 'details.json');
		if (!existsSync(eventPath)) {
			eventPath = path.join(eventsDir, `${id}.json`);
		}

		const content = await fs.readFile(eventPath, 'utf8');
		const event = JSON.parse(content);

		const updatedEvent = { ...event, ...updates };
		await fs.writeFile(eventPath, JSON.stringify(updatedEvent, null, 2));

		return NextResponse.json({ success: true, event: updatedEvent });
	} catch (err) {
		return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
	}
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const eventDir = path.join(eventsDir, id);
		if (existsSync(eventDir)) {
			await fs.rm(eventDir, { recursive: true, force: true });
		} else {
			const flatPath = path.join(eventsDir, `${id}.json`);
			if (existsSync(flatPath)) {
				await fs.unlink(flatPath);
			}
		}
		return NextResponse.json({ success: true });
	} catch (err) {
		return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
	}
}
