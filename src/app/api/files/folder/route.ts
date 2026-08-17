/** @format */

import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		const parentPath = body.path;
		const folderName = body.name;

		if (!parentPath || !folderName) {
			return NextResponse.json(
				{
					error: 'Missing path or folder name',
				},
				{
					status: 400,
				}
			);
		}

		const targetPath = path.join(parentPath, folderName);

		try {
			await fs.access(targetPath);

			return NextResponse.json(
				{
					error: 'Folder already exists',
				},
				{
					status: 409,
				}
			);
		} catch {}

		await fs.mkdir(targetPath, {
			recursive: true,
		});

		return NextResponse.json({
			success: true,
		});
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{
				error: 'Failed to create folder',
			},
			{
				status: 500,
			}
		);
	}
}
