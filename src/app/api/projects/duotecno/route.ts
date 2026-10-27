/** @format */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ProgrammationVersionFolder, readVersionedProjectJson, resolveVersionFolder } from '@/lib/duotecnoVersions';

export const dynamic = 'force-dynamic';

function loadProjectsSettings() {
	const DATA_DIR = path.join(process.cwd(), 'data');
	const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json');
	const raw = fs.readFileSync(PROJECTS_PATH, 'utf8');
	return JSON.parse(raw);
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

function readVersionPayload(clientDir: string, versions: ProgrammationVersionFolder[], selectedIndex: number, targetFolder: string | null) {
	// 1. Load versioned canbus setup (falls back to most recent body we already had)
	let canbusSetup: any = null;
	const canbusJson = readVersionedProjectJson(clientDir, versions, selectedIndex, 'canbus.json');
	if (canbusJson?.setup) {
		canbusSetup = canbusJson.setup;
	} else {
		const metaJson = readJsonIfExists(path.join(clientDir, 'metadata.json'));
		if (metaJson?.setup) canbusSetup = metaJson.setup;
	}

	const manualIps = readVersionedProjectJson(clientDir, versions, selectedIndex, 'ips.json') ?? [];

	if (!targetFolder) {
		return {
			latestFolder: null,
			canbusSetup,
			manualIps,
			nodeDatabase: null,
			nodeDbTxt: null,
			bindingTxt: null,
			nodeServices: null,
			triggersByHex: {},
			moodsByHex: {},
			ledTemplateTxt: null,
			ledsCfgByNode: {},
			cameras: null,
		};
	}

	const configDir = path.join(targetFolder, 'Config');
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
		const jsonDir = path.join(targetFolder, 'JSON');
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

	// Read TriggersActionsconfig_<hex>.json and MoodConfig_<hex>.txt for serverNodes
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

	// Read LEDConfig template + ledscfg_<hex>.txt
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

	return {
		latestFolder: targetFolder,
		canbusSetup,
		manualIps,
		nodeDatabase,
		nodeDbTxt,
		bindingTxt,
		nodeServices,
		triggersByHex,
		moodsByHex,
		ledTemplateTxt,
		ledsCfgByNode,
		cameras,
	};
}

export async function GET(request: NextRequest) {
	try {
		const client = request.nextUrl.searchParams.get('client');
		const requestedVersion = request.nextUrl.searchParams.get('version');

		if (!client) {
			return NextResponse.json({ error: 'Missing client' }, { status: 400 });
		}

		const settings = loadProjectsSettings();
		const clientDir = path.resolve(process.cwd(), settings.path, client);
		const progDir = path.join(clientDir, 'Programmation');

		const { versions, selected, latest, selectedIndex } = resolveVersionFolder(progDir, requestedVersion);

		let targetConfigRoot = selected?.configRoot ?? null;
		if (!targetConfigRoot && fs.existsSync(path.join(progDir, 'Config'))) {
			targetConfigRoot = progDir;
		}

		const payload = readVersionPayload(clientDir, versions, selectedIndex, targetConfigRoot);

		return NextResponse.json(
			{
				...payload,
				versions,
				selectedVersion: selected?.id ?? null,
				latestVersion: latest?.id ?? null,
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
