/** @format */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const PACKAGE_PATH = path.join(process.cwd(), "package.json");

// 🔧 Repo Configuration
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

/* ==========================================================
   GET → Triggers Update & Streams Live Terminal Logs (EventSource Compatible)
========================================================== */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (message: string) => {
        // Formatting clean data strings for Server-Sent Events (SSE)
        controller.enqueue(encoder.encode(`data: ${message.trim()}\n\n`));
      };

      send("Starting update pipeline...");

      // 🔑 FIX: Run via an external batch script so Next.js doesn't kill itself mid-build
      // 🔑 FIX: process.env is passed so Git and Node can read system PATH setups
      const child = spawn("cmd.exe", ["/c", "scripts\\update.bat"], {
        cwd: process.cwd(),
        env: process.env,
      });

      child.stdout.on("data", (data) => {
        send(data.toString());
      });

      child.stderr.on("data", (data) => {
        send(`LOG: ${data.toString()}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          send(
            "Build finished successfully! Background service restart scheduled.",
          );
        } else {
          send(
            `Update pipeline exited with code ${code}. Check logs/error.log for details.`,
          );
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Prevents Easypanel/Nginx reverse proxy buffer locks
    },
  });
}

/* ==========================================================
   PATCH → Simple JSON Endpoint to Check Versions
========================================================== */
export async function PATCH() {
  try {
    const local = getLocalVersion();
    const remote = await getRemoteVersion();

    return NextResponse.json({
      localVersion: local,
      remoteVersion: remote,
      updateAvailable: local !== remote,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
