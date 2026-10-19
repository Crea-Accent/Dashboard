/** @format */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

export async function GET() {
	const session = await getServerSession(authConfig);
	const permissions = session?.user?.permissions || [];

	if (!session || !permissions.includes('admin.write')) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const dataDir = path.join(process.cwd(), 'data');
		const zip = new AdmZip();

		if (fs.existsSync(dataDir)) {
			zip.addLocalFolder(dataDir, 'data');
		}

		const zipBuffer = zip.toBuffer();
		const dateStr = new Date().toISOString().split('T')[0];

		return new NextResponse(new Uint8Array(zipBuffer), {
			status: 200,
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="crea-accent-backup-${dateStr}.zip"`,
			},
		});
	} catch (err: any) {
		console.error('Failed to generate backup zip:', err);
		return NextResponse.json({ error: err.message || 'Failed to generate backup' }, { status: 500 });
	}
}
