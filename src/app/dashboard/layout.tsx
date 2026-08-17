/** @format */

import { Metadata } from 'next';
import SidePanel from '@/components/SidePanel';
import Sidebar from '@/components/Sidebar';
import { SidebarLayout } from '@/components/SidebarLayout';
import { StatusProvider } from '@/providers/StatusProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { authConfig } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
	title: 'Crea-Accent | Dashboard',
	description: '',
	icons: {
		icon: '/favicon.svg',
	},
};

export default async function DashboardLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await getServerSession(authConfig);
	const headerList = await headers();

	// Not logged in
	if (!session && !headerList.get('x-current-path')?.match(new RegExp('\/dashboard\/projects\/\w*'))) return redirect('/auth/login');

	const permissions = session?.user?.permissions ?? [];

	// Client users are not allowed in dashboard
	if (permissions.includes('client.read') || permissions.includes('client.write')) return redirect('/portal');

	return (
		<>
			<ToastProvider>
				<StatusProvider>
					<SidebarLayout>
						<Sidebar />
						<SidePanel />
						<main className="flex-1 w-full md:px-6 py-25 md:py-25">{children}</main>
					</SidebarLayout>
				</StatusProvider>
			</ToastProvider>
		</>
	);
}
