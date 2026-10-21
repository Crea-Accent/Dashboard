/** @format */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function loadProjectsSettings() {
	const DATA_DIR = path.join(process.cwd(), 'data');
	const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');
	const raw = fs.readFileSync(PROJECTS_PATH, 'utf8');
	return JSON.parse(raw);
}

function parseFolderVersion(rawName: string): { date: number; revision: number } {
	const name = rawName.replace(/\.[^.]+$/, '');
	const parts = name.split('__');
	const rawDate = parts.find((p) => /^\d{8}$/.test(p)) ?? '';

	let date = 0;
	if (rawDate) {
		if (/^(19|20)\d{6}$/.test(rawDate)) {
			date = Number(rawDate);
		} else if (/^\d{4}(19|20)\d{2}$/.test(rawDate)) {
			const dd = rawDate.slice(0, 2);
			const mm = rawDate.slice(2, 4);
			const yyyy = rawDate.slice(4, 8);
			date = Number(`${yyyy}${mm}${dd}`);
		} else {
			date = Number(rawDate);
		}
	}

	const revMatch = name.match(/_(\d+)$/);
	const revision = revMatch ? Number(revMatch[1]) : 0;

	return { date, revision };
}

function findLatestProgrammationFolder(progDir: string): string | null {
	if (!fs.existsSync(progDir)) return null;

	const entries = fs.readdirSync(progDir, { withFileTypes: true });
	const dirs = entries
		.filter((e) => e.isDirectory())
		.map((e) => {
			const fullPath = path.join(progDir, e.name);
			const { date, revision } = parseFolderVersion(e.name);
			let mtimeMs = 0;
			try {
				mtimeMs = fs.statSync(fullPath).mtimeMs;
			} catch {
				// Ignore
			}
			return {
				name: e.name,
				fullPath,
				date,
				revision,
				mtimeMs,
			};
		})
		.sort((a, b) => {
			if (b.date !== a.date) return b.date - a.date;
			if (b.revision !== a.revision) return b.revision - a.revision;
			return b.mtimeMs - a.mtimeMs;
		});

	// Check sorted top-level directories first (fast path: avoids scanning old backups)
	for (const d of dirs) {
		const configDir = path.join(d.fullPath, 'Config');
		if (fs.existsSync(configDir)) {
			return d.fullPath;
		}
		// Or one level deeper if extracted inside a wrapper folder
		try {
			const subEntries = fs.readdirSync(d.fullPath, { withFileTypes: true });
			for (const sub of subEntries) {
				if (sub.isDirectory() && fs.existsSync(path.join(d.fullPath, sub.name, 'Config'))) {
					return path.join(d.fullPath, sub.name);
				}
			}
		} catch {
			// Ignore
		}
	}

	// Fallback if Config is directly in progDir
	if (fs.existsSync(path.join(progDir, 'Config'))) {
		return progDir;
	}

	return null;
}

function readTextIfExists(filePath: string): string | null {
	try {
		if (fs.existsSync(filePath)) {
			return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
		}
	} catch {
		// Ignore
	}
	return null;
}

function readJsonIfExists(filePath: string): any {
	const txt = readTextIfExists(filePath);
	if (!txt) return null;
	try {
		return JSON.parse(txt);
	} catch {
		return null;
	}
}

export async function GET(request: NextRequest) {
	try {
		const client = request.nextUrl.searchParams.get('client');
		if (!client) {
			return NextResponse.json({ error: 'Missing client' }, { status: 400 });
		}

		const settings = loadProjectsSettings();
		const clientDir = path.resolve(process.cwd(), settings.path, client);
		const progDir = path.join(clientDir, 'Programmation');

		// 1. Load canbus setup
		let canbusSetup: any = null;
		const canbusJson = readJsonIfExists(path.join(clientDir, 'canbus.json'));
		if (canbusJson?.setup) {
			canbusSetup = canbusJson.setup;
		} else {
			const metaJson = readJsonIfExists(path.join(clientDir, 'metadata.json'));
			if (metaJson?.setup) canbusSetup = metaJson.setup;
		}

		// 2. Find latest programmation folder without recursive statSync across all backups
		const latestFolder = findLatestProgrammationFolder(progDir);
		if (!latestFolder) {
			return NextResponse.json({
				latestFolder: null,
				canbusSetup,
				nodeDatabase: null,
				nodeDbTxt: null,
				bindingTxt: null,
				nodeServices: null,
				triggersByHex: {},
				moodsByHex: {},
				ledTemplateTxt: null,
				ledsCfgByNode: {},
				cameras: null,
			});
		}

		const configDir = path.join(latestFolder, 'Config');
		const configEntries = fs.existsSync(configDir) ? fs.readdirSync(configDir) : [];
		const findConfigFile = (predicate: (lowerName: string) => boolean): string | null => {
			const found = configEntries.find((name) => predicate(name.toLowerCase()));
			return found ? path.join(configDir, found) : null;
		};

		const nodeDbPath = findConfigFile((n) => n === 'nodedatabase.cache.json');
		const nodeDbTxtPath = findConfigFile((n) => n === 'nodedatabase.txt');
		const bindingPath = findConfigFile((n) => n === 'bindingconfiginfo.txt');
		const nodeServicesPath = findConfigFile((n) => n === 'projectnodeservices.json');
		const camerasPath = findConfigFile((n) => n === 'cameras.json');

		const nodeDatabase = nodeDbPath ? readJsonIfExists(nodeDbPath) : null;
		const nodeDbTxt = nodeDbTxtPath ? readTextIfExists(nodeDbTxtPath) : null;
		const bindingTxt = bindingPath ? readTextIfExists(bindingPath) : null;
		const nodeServices = nodeServicesPath ? readJsonIfExists(nodeServicesPath) : null;
		let cameras = camerasPath ? readJsonIfExists(camerasPath) : null;
		if (!cameras) {
			const jsonDir = path.join(latestFolder, 'JSON');
			if (fs.existsSync(jsonDir)) {
				try {
					for (const sub of fs.readdirSync(jsonDir, { withFileTypes: true })) {
						if (sub.isDirectory()) {
							const candidate = path.join(jsonDir, sub.name, 'cameras.json');
							const parsed = readJsonIfExists(candidate);
							if (parsed) {
								cameras = parsed;
								break;
							}
						}
					}
				} catch {
					// Ignore
				}
			}
		}

		// 3. Read TriggersActionsconfig_<hex>.json and MoodConfig_<hex>.txt for serverNodes
		const triggersByHex: Record<string, any> = {};
		const moodsByHex: Record<string, string> = {};
		if (Array.isArray(nodeServices?.serverNodes)) {
			for (const srvNode of nodeServices.serverNodes) {
				const hexCode = String(srvNode.logicalAddress || '')
					.trim()
					.toLowerCase()
					.replace(/^0x/, '')
					.padStart(2, '0');
				if (!hexCode) continue;

				const trigPath = findConfigFile((n) => n === `triggersactionsconfig_${hexCode}.json`);
				if (trigPath) {
					const trigJson = readJsonIfExists(trigPath);
					if (trigJson) triggersByHex[hexCode] = trigJson;
				}

				const moodPath = findConfigFile((n) => n === `moodconfig_${hexCode}.txt`);
				if (moodPath) {
					const moodTxt = readTextIfExists(moodPath);
					if (moodTxt) moodsByHex[hexCode] = moodTxt;
				}
			}
		}

		// 4. Read LEDConfig template + ledscfg_<hex>.txt
		let ledTemplateTxt: string | null = null;
		const ledConfigDir = path.join(configDir, 'LEDConfig');
		if (fs.existsSync(ledConfigDir)) {
			try {
				const ledEntries = fs.readdirSync(ledConfigDir);
				const selFile = ledEntries.find((n) => n.toLowerCase() === 'ledconfigselectedtemplate.txt');
				let tplFile: string | undefined;
				if (selFile) {
					const selName = (readTextIfExists(path.join(ledConfigDir, selFile)) || '').trim().toLowerCase();
					if (selName) {
						tplFile = ledEntries.find((n) => n.toLowerCase() === `ledconfigtemplate,${selName}.txt`);
					}
				}
				if (!tplFile) {
					tplFile = ledEntries.find((n) => n.toLowerCase().startsWith('ledconfigtemplate,'));
				}
				if (tplFile) {
					ledTemplateTxt = readTextIfExists(path.join(ledConfigDir, tplFile));
				}
			} catch {
				// Ignore
			}
		}

		const ledsCfgByNode: Record<string, string> = {};
		for (const name of configEntries) {
			const match = name.match(/^ledscfg_([0-9a-f]{2})\.txt$/i);
			if (match) {
				const nodeKey = `0x${match[1].toLowerCase()}`;
				const txt = readTextIfExists(path.join(configDir, name));
				if (txt) ledsCfgByNode[nodeKey] = txt;
			}
		}

		return NextResponse.json(
			{
				latestFolder,
				canbusSetup,
				nodeDatabase,
				nodeDbTxt,
				bindingTxt,
				nodeServices,
				triggersByHex,
				moodsByHex,
				ledTemplateTxt,
				ledsCfgByNode,
				cameras,
			},
			{
				headers: {
					'Cache-Control': 'no-store, no-cache, must-revalidate',
				},
			}
		);
	} catch (error) {
		console.error('Error loading duotecno data:', error);
		return NextResponse.json({ error: 'Failed to load duotecno data' }, { status: 500 });
	}
}
