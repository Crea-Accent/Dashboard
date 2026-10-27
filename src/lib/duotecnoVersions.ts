/** @format */

import fs from 'fs';
import path from 'path';

export type ProgrammationVersionFolder = {
	id: string;
	folderPath: string;
	configRoot: string;
	date: number;
	formattedDate: string;
	revision: number;
	uploader: string;
	comment: string;
	mtimeMs: number;
	label: string;
};

export function parseFolderVersion(rawName: string): {
	date: number;
	formattedDate: string;
	revision: number;
	uploader: string;
	comment: string;
} {
	const name = rawName.replace(/\.[^.]+$/, '');
	const parts = name.split('__');
	const dateIdx = parts.findIndex((p) => /^\d{8}$/.test(p));
	const rawDate = dateIdx >= 0 ? parts[dateIdx] : '';

	let date = 0;
	let formattedDate = '';
	if (rawDate) {
		if (/^(19|20)\d{6}$/.test(rawDate)) {
			date = Number(rawDate);
			const yyyy = rawDate.slice(0, 4);
			const mm = rawDate.slice(4, 6);
			const dd = rawDate.slice(6, 8);
			formattedDate = `${dd}/${mm}/${yyyy}`;
		} else if (/^\d{4}(19|20)\d{2}$/.test(rawDate)) {
			const dd = rawDate.slice(0, 2);
			const mm = rawDate.slice(2, 4);
			const yyyy = rawDate.slice(4, 8);
			date = Number(`${yyyy}${mm}${dd}`);
			formattedDate = `${dd}/${mm}/${yyyy}`;
		} else {
			date = Number(rawDate);
			formattedDate = rawDate;
		}
	}

	const revMatch = name.match(/_(\d+)$/);
	const revision = revMatch ? Number(revMatch[1]) : 0;

	const afterDate = dateIdx >= 0 ? parts.slice(dateIdx + 1) : parts.slice(1);
	const cleanedAfter = afterDate.map((segment, idx) => (idx === afterDate.length - 1 ? segment.replace(/_(\d+)$/, '') : segment)).filter(Boolean);

	const uploader = cleanedAfter[0] ?? '';
	const comment = cleanedAfter.slice(1).join(' ');

	return { date, formattedDate, revision, uploader, comment };
}

function findConfigRootInDir(dirPath: string): string | null {
	if (fs.existsSync(path.join(dirPath, 'Config'))) {
		return dirPath;
	}
	try {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true });
		if (entries.some((e) => e.isFile() && e.name.toLowerCase().endsWith('.duo'))) {
			return dirPath;
		}
		for (const sub of entries) {
			if (sub.isDirectory()) {
				const subPath = path.join(dirPath, sub.name);
				if (fs.existsSync(path.join(subPath, 'Config'))) {
					return subPath;
				}
				try {
					const subFiles = fs.readdirSync(subPath, { withFileTypes: true });
					if (subFiles.some((f) => f.isFile() && f.name.toLowerCase().endsWith('.duo'))) {
						return subPath;
					}
				} catch {
					// Ignore
				}
			}
		}
	} catch {
		// Ignore
	}
	return null;
}

export function listProgrammationFolders(progDir: string): ProgrammationVersionFolder[] {
	if (!fs.existsSync(progDir)) return [];

	let entries: fs.Dirent[] = [];
	try {
		entries = fs.readdirSync(progDir, { withFileTypes: true });
	} catch {
		return [];
	}

	const rawDirs = entries
		.filter((e) => e.isDirectory())
		.map((e) => {
			const folderPath = path.join(progDir, e.name);
			const configRoot = findConfigRootInDir(folderPath);
			if (!configRoot) return null;

			const { date, formattedDate, revision, uploader, comment } = parseFolderVersion(e.name);
			let mtimeMs = 0;
			try {
				mtimeMs = fs.statSync(folderPath).mtimeMs;
			} catch {
				// Ignore
			}

			return {
				id: e.name,
				folderPath,
				configRoot,
				date,
				formattedDate,
				revision,
				uploader,
				comment,
				mtimeMs,
				label: '',
			};
		})
		.filter((x): x is ProgrammationVersionFolder => x !== null)
		.sort((a, b) => {
			if (b.date !== a.date) return b.date - a.date;
			if (b.revision !== a.revision) return b.revision - a.revision;
			return b.mtimeMs - a.mtimeMs;
		});

	const total = rawDirs.length;
	return rawDirs.map((item, idx) => {
		const vNum = total - idx;
		const parts = [`v${vNum}`];
		if (item.formattedDate) {
			parts.push(item.formattedDate);
		} else {
			parts.push(item.id);
		}
		if (item.revision > 0) {
			parts.push(`#${item.revision}`);
		}
		if (item.uploader) {
			parts.push(`(${item.uploader})`);
		}
		if (idx === 0) {
			parts.push('— Latest');
		}
		return {
			...item,
			label: parts.join(' '),
		};
	});
}

export function resolveVersionFolder(
	progDir: string,
	requestedVersion?: string | null
): {
	versions: ProgrammationVersionFolder[];
	selected: ProgrammationVersionFolder | null;
	latest: ProgrammationVersionFolder | null;
	selectedIndex: number;
} {
	const versions = listProgrammationFolders(progDir);
	const latest = versions[0] ?? null;

	if (!versions.length) {
		return { versions: [], selected: null, latest: null, selectedIndex: -1 };
	}

	if (requestedVersion) {
		const normalized = requestedVersion.trim();
		const idx = versions.findIndex(
			(v) => v.id === normalized || v.folderPath.replace(/\\/g, '/') === normalized.replace(/\\/g, '/') || v.configRoot.replace(/\\/g, '/') === normalized.replace(/\\/g, '/')
		);
		if (idx >= 0) {
			return {
				versions,
				selected: versions[idx],
				latest,
				selectedIndex: idx,
			};
		}
	}

	return {
		versions,
		selected: latest,
		latest,
		selectedIndex: 0,
	};
}

function readJsonSafe(filePath: string): any {
	try {
		if (fs.existsSync(filePath)) {
			const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
			return JSON.parse(raw);
		}
	} catch {
		// Ignore
	}
	return null;
}

/**
 * Reads a versioned JSON file (canbus.json or ips.json) for the selected version.
 * If the selected version does not yet have its own file, it falls back to the most recent
 * body we already had (checking earlier/newer version folders and the project root file).
 */
export function readVersionedProjectJson(clientDir: string, versions: ProgrammationVersionFolder[], selectedIndex: number, fileName: 'canbus.json' | 'ips.json'): any {
	// 1. Check the exact selected version folder first
	if (selectedIndex >= 0 && versions[selectedIndex]) {
		const exactPath = path.join(versions[selectedIndex].folderPath, fileName);
		const exactData = readJsonSafe(exactPath);
		if (exactData !== null) return exactData;
	}

	const rootData = readJsonSafe(path.join(clientDir, fileName));

	// 2. If selected is the latest version (index 0), prefer the project root body first
	if (selectedIndex <= 0 && rootData !== null) {
		return rootData;
	}

	// 3. Otherwise walk earlier versions from selectedIndex + 1, then fall back to rootData
	if (selectedIndex >= 0) {
		for (let i = selectedIndex + 1; i < versions.length; i++) {
			const candidate = readJsonSafe(path.join(versions[i].folderPath, fileName));
			if (candidate !== null) return candidate;
		}
	}

	if (rootData !== null) return rootData;

	for (let i = 0; i < versions.length; i++) {
		const candidate = readJsonSafe(path.join(versions[i].folderPath, fileName));
		if (candidate !== null) return candidate;
	}

	return null;
}

/**
 * Writes a versioned JSON file (canbus.json or ips.json) for the selected version.
 * Preserves the previous version's snapshot before updating the latest version, and syncs
 * the project root file when updating the latest version.
 */
export function writeVersionedProjectJson(
	clientDir: string,
	versions: ProgrammationVersionFolder[],
	selectedIndex: number,
	fileName: 'canbus.json' | 'ips.json',
	data: any,
	mergeObject = false
): void {
	const rootFilePath = path.join(clientDir, fileName);
	const currentMostRecent = readVersionedProjectJson(clientDir, versions, 0, fileName);

	// If editing the latest version and the previous version (versions[1]) doesn't have a snapshot yet,
	// snapshot the previous state into versions[1] so its history is preserved.
	if (selectedIndex === 0 && versions.length > 1 && currentMostRecent !== null) {
		const prevVersionFile = path.join(versions[1].folderPath, fileName);
		if (!fs.existsSync(prevVersionFile)) {
			try {
				fs.writeFileSync(prevVersionFile, JSON.stringify(currentMostRecent, null, '\t'));
			} catch {
				// Ignore
			}
		}
	}

	let finalData = data;
	if (mergeObject && typeof data === 'object' && data !== null && !Array.isArray(data)) {
		const baseExisting = selectedIndex >= 0 ? readVersionedProjectJson(clientDir, versions, selectedIndex, fileName) : currentMostRecent;
		if (baseExisting && typeof baseExisting === 'object' && !Array.isArray(baseExisting)) {
			finalData = { ...baseExisting, ...data };
		}
	}

	if (selectedIndex >= 0 && versions[selectedIndex]) {
		const targetVersionFile = path.join(versions[selectedIndex].folderPath, fileName);
		fs.writeFileSync(targetVersionFile, JSON.stringify(finalData, null, '\t'));
	}

	// Keep root file in sync when editing the latest version (or when no programmation versions exist yet)
	if (selectedIndex <= 0) {
		fs.writeFileSync(rootFilePath, JSON.stringify(finalData, null, '\t'));
	}
}
