/** @format */

import { NextResponse } from "next/server";
import { spawn } from "child_process";

export async function POST() {
  try {
    spawn("cmd.exe", ["/c", "scripts\\restart.bat"], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
      env: process.env,
    }).unref();

    return NextResponse.json({ ok: true, message: "Restarting service..." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
