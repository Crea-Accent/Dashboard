/** @format */

import { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import { SidebarLayout } from '@/components/SidebarLayout';
import { authConfig } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { getUserProjects } from '@/lib/projects';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
	title: 'Crea-Accent | Portal',
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

	if (!session) redirect('/auth/login');

	const projects = getUserProjects(session.user.id);

	const items = projects.map((project) => ({
		label: project.name,
		href: `/portal/${encodeURIComponent(project.id)}`,
	}));

	return (
		<>
			<Sidebar type="portal" items={items ?? []} />

			<SidebarLayout>
				<main className="flex-1 min-h-0 w-full px-4 md:px-6 lg:px-8 py-6">{children}</main>
			</SidebarLayout>
		</>
	);
}
