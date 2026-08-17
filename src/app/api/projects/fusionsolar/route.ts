/** @format */

import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for token and data to prevent rate limits (especially in React strict mode)
let cachedToken: string | null = null;
let tokenExpiry = 0;

const listCache: { data: any; timestamp: number } = {
	data: null,
	timestamp: 0,
};
const LIST_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const kpiCache: { [stationCode: string]: { data: any; timestamp: number } } = {};
const KPI_CACHE_EXPIRY = 60 * 1000; // 1 minute

export async function POST(request: NextRequest) {
	try {
		const { stationCode, action = 'kpi' } = await request.json();

		if (action === 'kpi' && !stationCode) {
			return NextResponse.json({ error: 'Missing stationCode' }, { status: 400 });
		}

		const username = process.env.FUSIONSOLAR_USERNAME;
		const password = process.env.FUSIONSOLAR_PASSWORD;
		const baseUrl = process.env.FUSIONSOLAR_BASE_URL;

		if (!username || !password || !baseUrl) {
			return NextResponse.json({ error: 'FusionSolar credentials not configured in environment' }, { status: 500 });
		}

		async function ensureLogin() {
			if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

			const loginRes = await fetch(`${baseUrl}/thirdData/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userName: username,
					systemCode: password,
				}),
			});

			const loginData = await loginRes.json().catch(() => ({}));

			if (!loginRes.ok || !loginData.success) {
				console.error('FusionSolar Login Failed:', loginRes.status, loginData);
				throw new Error('Failed to authenticate with FusionSolar');
			}

			const xsrfToken = loginRes.headers.get('xsrf-token');
			if (!xsrfToken) {
				console.error('FusionSolar Login Headers:', Object.fromEntries(loginRes.headers.entries()));
				throw new Error('No xsrf-token returned from FusionSolar');
			}

			cachedToken = xsrfToken;
			tokenExpiry = Date.now() + 25 * 60 * 1000; // 25 minutes (expires in 30)
			return xsrfToken;
		}

		let xsrfToken;
		try {
			xsrfToken = await ensureLogin();
		} catch (e: any) {
			return NextResponse.json({ error: e.message }, { status: 401 });
		}

		if (action === 'list') {
			if (listCache.data && Date.now() - listCache.timestamp < LIST_CACHE_EXPIRY) {
				return NextResponse.json({
					success: true,
					data: listCache.data,
				});
			}

			const listRes = await fetch(`${baseUrl}/thirdData/getStationList`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'xsrf-token': xsrfToken,
				},
				body: JSON.stringify({
					pageNo: 1,
					pageSize: 100,
				}),
			});

			if (!listRes.ok) {
				return NextResponse.json({ error: 'Failed to fetch station list' }, { status: 502 });
			}

			const listData = await listRes.json();

			if (!listData.success) {
				console.error('FusionSolar Station List Failed:', listData);
				// If token is somehow invalid, clear it (but NOT on 407 which is just a rate limit)
				if (listData.failCode === 301 || listData.failCode === 401) {
					cachedToken = null;
				}
				return NextResponse.json(
					{
						error: listData.failCode || 'API returned failure status',
						rawAPIResponse: listData,
					},
					{ status: 502 }
				);
			}

			const list = listData.data?.list || [];
			listCache.data = list;
			listCache.timestamp = Date.now();

			return NextResponse.json({
				success: true,
				data: list,
			});
		}

		// 2. Fetch Station Real KPI (Default action)
		if (stationCode && kpiCache[stationCode] && Date.now() - kpiCache[stationCode].timestamp < KPI_CACHE_EXPIRY) {
			return NextResponse.json({
				success: true,
				data: kpiCache[stationCode].data,
			});
		}

		const kpiRes = await fetch(`${baseUrl}/thirdData/getStationRealKpi`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'xsrf-token': xsrfToken,
			},
			body: JSON.stringify({
				stationCodes: stationCode,
			}),
		});

		if (!kpiRes.ok) {
			return NextResponse.json({ error: 'Failed to fetch station KPIs' }, { status: 502 });
		}

		const kpiData = await kpiRes.json();

		if (!kpiData.success) {
			console.error('FusionSolar KPI Failed:', kpiData);
			// If token invalid, clear it (but NOT on 407 which is just a rate limit)
			if (kpiData.failCode === 301 || kpiData.failCode === 401) {
				cachedToken = null;
			}
			return NextResponse.json(
				{
					error: kpiData.failCode || 'API returned failure status',
					rawAPIResponse: kpiData,
				},
				{ status: 502 }
			);
		}

		const data = kpiData.data?.[0] || null;
		if (stationCode) {
			kpiCache[stationCode] = { data, timestamp: Date.now() };
		}

		return NextResponse.json({
			success: true,
			data,
		});
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
