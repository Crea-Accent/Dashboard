/** @format */

import { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Crea-Accent | Account',
	description: '',
	icons: {
		icon: '/favicon.svg',
	},
};

export default async function AuthLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return children;
}
