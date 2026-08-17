/** @format */

import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth";
import fs from "fs";
import { getServerSession } from "next-auth";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const WORKSPACE_FILE = path.join(DATA_DIR, "workspace.json");

function getWorkspaceRoot() {
  if (!fs.existsSync(WORKSPACE_FILE)) return null;

  const raw = fs.readFileSync(WORKSPACE_FILE, "utf-8");
  const data = JSON.parse(raw);

  return data.path || null;
}

export async function GET() {
  const session = await getServerSession(authConfig);

  if (!session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const root = getWorkspaceRoot();

  if (!root) {
    return NextResponse.json(
      { error: "Workspace not configured" },
      { status: 400 },
    );
  }

  const username = session.user.name.replace(/[^\w.-]/g, "_"); // don’t trust humans

  const userPath = path.join(/*turbopackIgnore: true*/ root, username);

  if (!fs.existsSync(/*turbopackIgnore: true*/ userPath)) {
    fs.mkdirSync(userPath, { recursive: true });
  }

  return NextResponse.json({
    path: userPath,
  });
}
