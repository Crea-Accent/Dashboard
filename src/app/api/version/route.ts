/** @format */

import { NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const PACKAGE_PATH = path.join(process.cwd(), "package.json");

// 🔧 change this to your repo
const REPO_OWNER = "Crea-Accent";
const REPO_NAME = "Panel";
const BRANCH = "main";

function getLocalVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
  return pkg.version;
}

async function getRemoteVersion(): Promise<string> {
  const res = await fetch(
    `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/package.json`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch remote package.json");
  }

  const pkg = await res.json();
  return pkg.version;
}

/* =========================
   GET → Version Check
========================= */

export async function GET() {
  try {
    const localVersion = getLocalVersion();
    const remoteVersion = await getRemoteVersion();

    return NextResponse.json({
      localVersion,
      remoteVersion,
      upToDate: localVersion === remoteVersion,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
