import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getContact } from "@/lib/contacts";

const eventsDir = path.join(process.cwd(), "data", "events");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string; contactId: string }> },
) {
  try {
    const { eventId, contactId } = await params;

    const eventPath = path.join(eventsDir, `${eventId}.json`);
    let event: any;
    try {
      const content = await fs.readFile(eventPath, "utf8");
      event = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    event.invites = event.invites || [];
    const invite = event.invites.find(
      (inv: any) => inv.contactId === contactId,
    );

    if (!invite) {
      return NextResponse.json({ error: "Not invited" }, { status: 403 });
    }

    const contact = await getContact(contactId);

    return NextResponse.json({
      event: {
        name: event.name,
        description: event.description,
        date: event.date,
        time: event.time,
        welcomeTime: event.welcomeTime,
        startTime: event.startTime,
        location: event.location,
      },
      contact: {
        name: contact?.name,
      },
      invite: {
        status: invite.status || "pending",
        guests: invite.guests || [],
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string; contactId: string }> },
) {
  try {
    const { eventId, contactId } = await params;
    const { status, guests } = await req.json();

    const eventPath = path.join(eventsDir, `${eventId}.json`);
    let event: any;
    try {
      const content = await fs.readFile(eventPath, "utf8");
      event = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    event.invites = event.invites || [];
    const inviteIndex = event.invites.findIndex(
      (inv: any) => inv.contactId === contactId,
    );

    if (inviteIndex === -1) {
      return NextResponse.json({ error: "Not invited" }, { status: 403 });
    }

    event.invites[inviteIndex] = {
      ...event.invites[inviteIndex],
      status,
      guests: Array.isArray(guests) ? guests.slice(0, 2) : [], // Limit to 2 guests
    };

    await fs.writeFile(eventPath, JSON.stringify(event, null, 2));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
