import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await params;
		const res = await fetch(`https://api.crea-accent.app/v1/messages/${id}`, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
			cache: 'no-store',
		});

		if (!res.ok) {
			return NextResponse.json({ error: `API responded with status ${res.status}` }, { status: res.status });
		}

		const data = await res.json();
		return NextResponse.json(data);
	} catch (error) {
		return NextResponse.json({ error: 'Failed to connect to external API' }, { status: 500 });
	}
}
