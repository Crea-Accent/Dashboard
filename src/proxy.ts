import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const allowedOrigins = ['http://localhost:3000', 'https://crea.dummi.me', 'https://crea-accent.app', 'https://www.crea-accent.app'];

export function proxy(request: NextRequest) {
	const headers = new Headers(request.headers);
	headers.set('x-current-path', request.nextUrl.pathname);

	const origin = request.headers.get('origin');

	const isAllowedOrigin = origin && (allowedOrigins.includes(origin) || origin.startsWith('http://192.168.') || origin.startsWith('http://172.16.') || origin.startsWith('http://10.'));

	if (request.nextUrl.pathname.startsWith('/api/') && isAllowedOrigin) {
		const resHeaders = new Headers();
		resHeaders.set('Access-Control-Allow-Origin', origin);
		resHeaders.set('Access-Control-Allow-Credentials', 'true');
		resHeaders.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
		resHeaders.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

		if (request.method === 'OPTIONS') {
			return new NextResponse(null, { headers: resHeaders, status: 204 });
		}

		const response = NextResponse.next({ headers });
		resHeaders.forEach((value, key) => response.headers.set(key, value));
		return response;
	}

	return NextResponse.next({ headers });
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
