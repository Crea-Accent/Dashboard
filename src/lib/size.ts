/** @format */

export function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes}b`;

	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)}kb`;

	const mb = kb / 1024;
	if (mb < 1024) return `${mb.toFixed(1)}Mb`;

	const gb = mb / 1024;
	return `${gb.toFixed(1)}Gb`;
}
