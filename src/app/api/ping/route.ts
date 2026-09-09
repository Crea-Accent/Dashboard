import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
	const ip = request.nextUrl.searchParams.get('ip');
	if (!ip || !/^[0-9a-zA-Z.-]+$/.test(ip)) {
		return NextResponse.json({ error: 'Invalid IP' }, { status: 400 });
	}

	try {
		const isWindows = process.platform === 'win32';
		const cmd = isWindows ? `ping -n 1 -w 1000 ${ip}` : `ping -c 1 -W 1 ${ip}`;

		await execAsync(cmd);
		return NextResponse.json({ alive: true });
	} catch (e) {
		return NextResponse.json({ alive: false });
	}
}
