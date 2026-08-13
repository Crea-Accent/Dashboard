/**
 * Calculates the appropriate text color (black or white) for a given background hex color.
 * Uses the YIQ equation for perceived brightness.
 */
export function getContrastYIQ(hexcolor?: string): 'black' | 'white' {
	if (!hexcolor) return 'white';

	let hex = hexcolor.replace('#', '');

	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((c) => c + c)
			.join('');
	}

	if (hex.length !== 6) return 'white';

	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);

	const yiq = (r * 299 + g * 587 + b * 114) / 1000;

	return yiq >= 128 ? 'black' : 'white';
}
