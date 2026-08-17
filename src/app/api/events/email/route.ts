import { NextResponse } from 'next/server';

export async function POST(request: Request) {
	try {
		const token = process.env.POSTMARK_API_TOKEN;

		if (!token) {
			return NextResponse.json({ error: 'Postmark API token missing' }, { status: 500 });
		}

		const response = await fetch('https://api.postmarkapp.com/email', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'X-Postmark-Server-Token': token,
			},
			body: JSON.stringify({
				From: 'crea@dummi.me',
				To: 'dummi@dummi.me', // Temporary: must match sender domain while Postmark account is pending approval
				Subject: 'New Event Alert',
				TextBody: 'A new event has been triggered from the Crea-Accent dashboard!',
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			console.error('Postmark Error:', data);
			return NextResponse.json({ error: 'Failed to send email', details: data }, { status: response.status });
		}

		return NextResponse.json({ success: true, data });
	} catch (error) {
		console.error('Email error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
