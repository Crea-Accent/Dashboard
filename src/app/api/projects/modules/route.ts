/** @format */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export type ModuleDefinition = {
	id: string;
	name: string;
	description?: string;
	detectable?: boolean;
};

export async function GET() {
	try {
		const modulesDir = path.join(process.cwd(), 'public', 'modules');

		const entries = await fs.readdir(modulesDir, {
			withFileTypes: true,
		});

		const modules: ModuleDefinition[] = [];

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const jsonPath = path.join(modulesDir, entry.name, 'module.json');

			try {
				const json = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

				modules.push(json);
			} catch {
				// Ignore folders without a valid module.json
			}
		}

		modules.sort((a, b) => a.name.localeCompare(b.name));

		return NextResponse.json({
			success: true,
			modules,
		});
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{
				success: false,
				error: 'Failed to load module definitions.',
			},
			{ status: 500 }
		);
	}
}
