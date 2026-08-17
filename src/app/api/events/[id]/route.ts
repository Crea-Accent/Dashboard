import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const eventsDir = path.join(process.cwd(), "data", "events");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const content = await fs.readFile(
      path.join(eventsDir, `${id}.json`),
      "utf8",
    );
    return NextResponse.json({ event: JSON.parse(content) });
  } catch (err) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { updates } = await req.json();

    const eventPath = path.join(eventsDir, `${id}.json`);
    const content = await fs.readFile(eventPath, "utf8");
    const event = JSON.parse(content);

    const updatedEvent = { ...event, ...updates };
    await fs.writeFile(eventPath, JSON.stringify(updatedEvent, null, 2));

    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 },
    );
  }
}
