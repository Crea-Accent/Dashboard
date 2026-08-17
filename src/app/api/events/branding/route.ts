import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
	try {
		const formData = await req.formData();
		const file = formData.get('file') as File | null;
		const type = formData.get('type') as string | null;

		if (!file || !type || (type !== 'banner' && type !== 'ribbon')) {
			return NextResponse.json({ error: 'Invalid file or type' }, { status: 400 });
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Delete existing files with the same prefix to avoid extension conflicts
		const publicDir = path.join(process.cwd(), 'public');
		const files = await fs.readdir(publicDir);
		for (const f of files) {
			if (f.startsWith(`${type}.`)) {
				await fs.unlink(path.join(publicDir, f));
			}
		}

		// Extract extension and save
		const ext = file.name.split('.').pop() || 'png';
		const fileName = `${type}.${ext}`;
		const filePath = path.join(publicDir, fileName);

		await fs.writeFile(filePath, buffer);

		return NextResponse.json({ success: true, fileName });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
	}
}
