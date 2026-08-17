/** @format */

import { NextRequest, NextResponse } from "next/server";

import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");

const SECRET = process.env.SECRET_KEY || "change-this";
const key = crypto.createHash("sha256").update(SECRET).digest();

/* ================= ENCRYPT / DECRYPT ================= */

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-ctr", key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(payload: string) {
  const [ivHex, contentHex] = payload.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const content = Buffer.from(contentHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-ctr", key, iv);
  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);

  return decrypted.toString();
}

/* ================= HELPERS ================= */

function loadProjectsPath(): string {
  const raw = fs.readFileSync(PROJECTS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), parsed.path);
}

function resolveProjectFolder(client: string, base: string) {
  const folder = path.resolve(base, client);
  if (!folder.startsWith(base)) throw new Error("Forbidden");
  return folder;
}

function metadataPath(folder: string) {
  return path.join(folder, "metadata.json");
}

/* ================= LOGIN PROCESS ================= */

function processLogins(existing: any[] = [], incoming: any[] = []) {
  return incoming.map((current) => {
    const old = existing.find((x) => x.id === current.id);

    let passwordEncrypted = old?.passwordEncrypted;

    if (current.password === "") {
      passwordEncrypted = undefined;
    } else if (current.password) {
      passwordEncrypted = encrypt(current.password);
    }

    return {
      id: current.id,
      label: current.label ?? "",
      link: current.link ?? "",
      username: current.username ?? "",
      visibleToClient: current.visibleToClient ?? false,
      passwordEncrypted,
    };
  });
}

/* ================= GET ================= */

export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client")!;
  const reveal = req.nextUrl.searchParams.get("reveal") === "true";

  const base = loadProjectsPath();
  const folder = resolveProjectFolder(client, base);
  const file = metadataPath(folder);

  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  if (data.logins && !Array.isArray(data.logins)) {
    data.logins = [
      ...(data.logins.company ?? []).map((login: any) => ({
        ...login,
        id: crypto.randomUUID(),
        visibleToClient: false,
      })),
      ...(data.logins.client ?? []).map((login: any) => ({
        ...login,
        id: crypto.randomUUID(),
        visibleToClient: true,
      })),
    ];
  }

  if (reveal && Array.isArray(data.logins)) {
    for (const login of data.logins) {
      if (login.passwordEncrypted) {
        login.password = decrypt(login.passwordEncrypted);
      }
    }
  }

  if (Array.isArray(data.logins)) {
    for (const login of data.logins) {
      delete login.passwordEncrypted;
    }
  }

  return NextResponse.json(data);
}

/* ================= PATCH ================= */

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  const { client, data, createShareCode } = body;

  const base = loadProjectsPath();
  const folder = resolveProjectFolder(client, base);
  const file = metadataPath(folder);

  const existing = JSON.parse(fs.readFileSync(file, "utf8"));

  // Share link request
  if (createShareCode) {
    if (!existing.shareCode) {
      existing.shareCode = crypto.randomUUID();

      fs.writeFileSync(file, JSON.stringify(existing, null, 2));
    }

    return NextResponse.json({
      ok: true,
      shareCode: existing.shareCode,
    });
  }

  const updated = {
    ...existing,
    ...data,
    logins: processLogins(
      Array.isArray(existing.logins) ? existing.logins : [],
      data.logins ?? [],
    ),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(file, JSON.stringify(updated, null, 2));

  return NextResponse.json({ ok: true });
}
