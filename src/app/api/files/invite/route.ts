/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import path from 'path';

const INVITES_DIR = path.join(process.cwd(), 'public', 'invites');
const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated-invites');

function ensureDirectories() {
	fs.mkdirSync(INVITES_DIR, { recursive: true });
	fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

export async function GET() {
	try {
		ensureDirectories();
		const files = fs.readdirSync(GENERATED_DIR);

		const invites = files
			.filter((f) => f.endsWith('.html'))
			.map((file) => {
				const full = path.join(GENERATED_DIR, file);
				const stats = fs.statSync(full);
				return {
					name: file,
					url: `/generated-invites/${file}`,
					created: stats.mtime.toISOString(),
				};
			})
			.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

		return NextResponse.json({ ok: true, invites });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const url = new URL(request.url);
		const name = url.searchParams.get('name');

		if (!name) {
			return NextResponse.json({ error: 'Missing name' }, { status: 400 });
		}

		const target = path.join(GENERATED_DIR, path.basename(name));
		if (fs.existsSync(target)) {
			fs.unlinkSync(target);
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		ensureDirectories();
		const contentType = request.headers.get('content-type') || '';

		// ==========================
		// Upload image track
		// ==========================
		if (contentType.includes('multipart/form-data')) {
			const formData = await request.formData();
			const file = formData.get('file') as File | null;

			if (!file) {
				return NextResponse.json({ error: 'No image' }, { status: 400 });
			}

			const filename = `${Date.now()}-${file.name}`;
			const buffer = Buffer.from(await file.arrayBuffer());
			await fs.promises.writeFile(path.join(INVITES_DIR, filename), buffer);

			return NextResponse.json({
				ok: true,
				imageUrl: `/invites/${filename}`,
			});
		}

		// ==========================
		// Generate HTML invite track
		// ==========================
		const body = await request.json();
		const { imageUrl, formUrl } = body;

		if (!imageUrl || !formUrl) {
			return NextResponse.json({ error: 'Missing data' }, { status: 400 });
		}

		const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    /* Adding a hover effect for modern clients that support embedded styles */
    .btn-pop:hover {
        background-color: #8fa37f !important;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(164, 183, 149, 0.4) !important;
    }
</style>
</head>

<body style="margin:0; padding:40px; background:#f5f5f5; text-align:center; font-family:Arial,sans-serif;">

    <img src="{{IMAGE_URL}}" alt="Invite" style="width:100%; max-width:600px; display:block; margin:auto; border-radius:24px;" />

    <div style="padding-top:30px;">
        
       <div style="margin-bottom:40px; text-align:center;">

    <a
        href="{{FORM_URL}}"
        style="
            background:#a4b795;
            color:#ffffff;
            display:inline-block;
            padding:20px 54px;
            border-radius:999px;
            text-decoration:none;
            font-size:16px;
            font-weight:700;
            letter-spacing:.6px;
            line-height:1;
            box-shadow:0 10px 28px rgba(164,183,149,.35);
            border:1px solid rgba(255,255,255,.15);
        "
    >
        Schrijf je nu in
    </a>

</div>

        <div style="text-align:center;">
            
            <a href="https://www.crea-accent.be" style="text-decoration:none; display:inline-block; margin:0 8px 10px 8px;" target="_blank">
                    <img src="https://crea.dummi.me/website.png" alt="Website" border="0" width="32" height="32" style="display:block; width:32px; height:32px;" />
                </a>
            <a href="https://www.instagram.com/crea.accent/" style="text-decoration:none; display:inline-block; margin:0 8px 10px 8px;" target="_blank">
                    <img src="https://crea.dummi.me/instagram.png" alt="Instagram" border="0" width="32" height="32" style="display:block; width:32px; height:32px;" />
                </a>
            <a href="https://www.linkedin.com/company/crea-accent" style="text-decoration:none; display:inline-block; margin:0 8px 10px 8px;" target="_blank">
                    <img src="https://crea.dummi.me/linkedin.png" alt="LinkedIn" border="0" width="32" height="32" style="display:block; width:32px; height:32px;" />
                </a>
            <a href="https://www.facebook.com/Crea.Accent.Verlichting" style="text-decoration:none; display:inline-block; margin:0 8px 10px 8px;" target="_blank">
                    <img src="https://crea.dummi.me/facebook.png" alt="Facebook" border="0" width="32" height="32" style="display:block; width:32px; height:32px;" />
                </a>
            </div>
    </div>

</body>
</html>`;

		const finalHtml = htmlTemplate.replace(/{{IMAGE_URL}}/g, imageUrl).replace(/{{FORM_URL}}/g, formUrl);

		const filename = `!!! INVOEGEN ALS TEKST!!!-${Date.now()}.html`;
		await fs.promises.writeFile(path.join(GENERATED_DIR, filename), finalHtml, 'utf8');

		return NextResponse.json({
			ok: true,
			url: `/generated-invites/${filename}`,
			name: filename,
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}
