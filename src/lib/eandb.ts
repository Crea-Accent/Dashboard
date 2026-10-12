/** @format */

import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

export type StockArticle = {
	barcode: string;
	title: string;
	brand?: string;
	category?: string;
	country?: string;
	type?: string;
	image?: string;
	notFound?: boolean;
	isCustom?: boolean;
	min?: number;
	max?: number;
	updatedAt: string;
};

export type StockSettings = {
	apiKey?: string;
};

// 30 days in milliseconds
export const CACHE_TTL_DAYS = 30;
export const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Checks if a cached article is still fresh (less than 30 days old).
 * Custom articles manually edited by users are always considered fresh.
 */
export function isArticleCacheFresh(article?: StockArticle): boolean {
	if (!article) return false;
	if (article.isCustom) return true;
	if (!article.updatedAt) return false;

	const ageMs = Date.now() - new Date(article.updatedAt).getTime();
	return !isNaN(ageMs) && ageMs < CACHE_TTL_MS;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const ARTICLES_CACHE_PATH = path.join(DATA_DIR, 'stock-articles.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'stock-settings.json');

async function ensureDataDir() {
	if (!existsSync(DATA_DIR)) {
		mkdirSync(DATA_DIR, { recursive: true });
	}
}

export async function getStockSettings(): Promise<StockSettings> {
	await ensureDataDir();
	try {
		if (existsSync(SETTINGS_PATH)) {
			const content = await fs.readFile(SETTINGS_PATH, 'utf-8');
			return JSON.parse(content);
		}
	} catch (e) {
		console.error('Failed to read stock settings:', e);
	}
	return {};
}

export async function saveStockSettings(settings: StockSettings): Promise<void> {
	await ensureDataDir();
	await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

export function getEanDbApiKey(settings?: StockSettings): string | undefined {
	return process.env.EAN_DB_API_KEY || process.env.EAN_DB_TOKEN || settings?.apiKey;
}

export async function getAllCachedArticles(): Promise<Record<string, StockArticle>> {
	await ensureDataDir();
	try {
		if (existsSync(ARTICLES_CACHE_PATH)) {
			const content = await fs.readFile(ARTICLES_CACHE_PATH, 'utf-8');
			return JSON.parse(content);
		}
	} catch (e) {
		console.error('Failed to read articles cache:', e);
	}
	return {};
}

export async function saveCachedArticles(articles: Record<string, StockArticle>): Promise<void> {
	await ensureDataDir();
	await fs.writeFile(ARTICLES_CACHE_PATH, JSON.stringify(articles, null, 2), 'utf-8');
}

export async function saveArticle(article: StockArticle): Promise<void> {
	const articles = await getAllCachedArticles();
	articles[article.barcode] = article;
	await saveCachedArticles(articles);
}

/**
 * Normalizes barcode strings by stripping non-digit characters if it looks like a barcode scanner artifact
 */
export function normalizeBarcode(raw: string): string {
	const trimmed = raw.trim();
	// If it's pure digits, return as-is
	if (/^\d+$/.test(trimmed)) return trimmed;
	return trimmed;
}

/**
 * Extracts the most appropriate human-readable title from EAN-DB product payload
 */
function extractTitle(product: any, barcode: string): string {
	if (!product) return barcode;

	const titles = product.titles || {};
	// Prioritize Dutch, then English, then French, German, or any available title
	const preferred = titles.nl || titles.en || titles.fr || titles.de;
	if (preferred && typeof preferred === 'string' && preferred.trim()) {
		return preferred.trim();
	}

	const anyTitle = Object.values(titles).find((t) => typeof t === 'string' && t.trim()) as string | undefined;
	if (anyTitle && anyTitle.trim()) {
		return anyTitle.trim();
	}

	if (typeof product.title === 'string' && product.title.trim()) {
		return product.title.trim();
	}

	return barcode;
}

function extractBrand(product: any): string | undefined {
	if (!product) return undefined;
	const meta = product.metadata?.generic;
	const brand = meta?.brand || meta?.manufacturer || product.brand || product.manufacturer;
	return typeof brand === 'string' && brand.trim() ? brand.trim() : undefined;
}

function extractCategory(product: any): string | undefined {
	if (!product) return undefined;
	if (Array.isArray(product.categories) && product.categories[0]?.name) {
		return String(product.categories[0].name).trim();
	}
	return undefined;
}

function extractImage(product: any): string | undefined {
	if (!product) return undefined;
	if (Array.isArray(product.images) && product.images[0]?.url) {
		return String(product.images[0].url).trim();
	}
	if (typeof product.image === 'string') return product.image.trim();
	return undefined;
}

/**
 * Fetches article info from ean-db.com API or local cache (with 30-day TTL)
 */
export async function getArticle(rawBarcode: string, options?: { forceRefresh?: boolean }): Promise<StockArticle> {
	const barcode = normalizeBarcode(rawBarcode);
	const cache = await getAllCachedArticles();
	const cached = cache[barcode];

	// If cache exists, is fresh (< 30 days old) or is a user-customized article, return without calling API
	if (!options?.forceRefresh && isArticleCacheFresh(cached)) {
		return cached;
	}

	const settings = await getStockSettings();
	const apiKey = getEanDbApiKey(settings);

	if (!apiKey) {
		// Return fallback when no API key is configured yet
		const fallback: StockArticle = cached || {
			barcode,
			title: barcode,
			updatedAt: new Date().toISOString(),
		};
		return fallback;
	}

	try {
		const res = await fetch(`https://ean-db.com/api/v2/product/${encodeURIComponent(barcode)}`, {
			headers: {
				Authorization: `Bearer ${apiKey.trim()}`,
				Accept: 'application/json',
				'User-Agent': 'Crea-Accent-Dashboard/1.0',
			},
			cache: 'no-store',
		});

		if (res.status === 404) {
			const notFoundArticle: StockArticle = {
				barcode,
				title: cached?.title || barcode,
				brand: cached?.brand,
				category: cached?.category,
				notFound: true,
				updatedAt: new Date().toISOString(),
			};
			cache[barcode] = notFoundArticle;
			await saveCachedArticles(cache);
			return notFoundArticle;
		}

		if (!res.ok) {
			const errorText = await res.text().catch(() => '');
			console.error(`EAN-DB API error for ${barcode}: ${res.status}`, errorText);
			if (cached) {
				cached.updatedAt = new Date().toISOString();
				cache[barcode] = cached;
				await saveCachedArticles(cache);
				return cached;
			}
			return {
				barcode,
				title: barcode,
				updatedAt: new Date().toISOString(),
			};
		}

		const data = await res.json();
		const product = data.product || data;

		const article: StockArticle = {
			barcode: product.barcode || barcode,
			title: extractTitle(product, barcode),
			brand: extractBrand(product),
			category: extractCategory(product),
			country: product.barcodeDetails?.country,
			type: product.barcodeDetails?.type,
			image: extractImage(product),
			notFound: false,
			min: cached?.min,
			max: cached?.max,
			updatedAt: new Date().toISOString(),
		};

		cache[barcode] = article;
		await saveCachedArticles(cache);
		return article;
	} catch (err) {
		console.error(`Failed to fetch article ${barcode} from EAN-DB:`, err);
		if (cached) {
			cached.updatedAt = new Date().toISOString();
			cache[barcode] = cached;
			await saveCachedArticles(cache);
			return cached;
		}
		return {
			barcode,
			title: barcode,
			updatedAt: new Date().toISOString(),
		};
	}
}

/**
 * Fetches multiple articles in batch, utilizing 30-day cache and querying EAN-DB only for expired/uncached barcodes
 */
export async function getArticles(rawBarcodes: string[]): Promise<Record<string, StockArticle>> {
	const barcodes = Array.from(new Set(rawBarcodes.map(normalizeBarcode).filter(Boolean)));
	const cache = await getAllCachedArticles();
	const result: Record<string, StockArticle> = {};
	const missing: string[] = [];

	for (const code of barcodes) {
		const cached = cache[code];
		if (isArticleCacheFresh(cached)) {
			result[code] = cached;
		} else {
			missing.push(code);
		}
	}

	if (missing.length === 0) {
		return result;
	}

	const settings = await getStockSettings();
	const apiKey = getEanDbApiKey(settings);

	if (!apiKey) {
		for (const code of missing) {
			result[code] = cache[code] || {
				barcode: code,
				title: code,
				updatedAt: new Date().toISOString(),
			};
		}
		return result;
	}

	// Fetch uncached barcodes concurrently (max 5 parallel requests)
	const CHUNK_SIZE = 5;
	for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
		const chunk = missing.slice(i, i + CHUNK_SIZE);
		await Promise.all(
			chunk.map(async (code) => {
				const article = await getArticle(code);
				result[code] = article;
			})
		);
	}

	return result;
}
