/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'procedures.json');

export async function GET() {
	try {
		const raw = await fs.readFile(CONFIG_PATH, 'utf8');

		return NextResponse.json(JSON.parse(raw));
	} catch {
		return NextResponse.json({
			path: '',
		});
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const body = await request.json();

		const config = {
			path: body.path ?? '',
		};

		await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));

		return NextResponse.json({
			success: true,
		});
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{
				error: 'Failed to save procedures settings',
			},
			{
				status: 500,
			}
		);
	}
}
