/** @format */
'use client';

import { useEffect, useState } from 'react';

import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { FolderOpen } from 'lucide-react';
import Link from 'next/link';
import Loading from '@/components/ui/Loading';
import PageHeader from '@/components/ui/PageHeader';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSidebar } from '@/providers/SidebarProvider';

export default function Page() {
	const router = useRouter();
	const { data: session } = useSession();
	const { setOpen } = useSidebar();

	const [projects, setProjects] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setOpen(false);

		(async () => {
			const res = await fetch('/api/portal/projects');
			const data = await res.json();

			const list = data.projects ?? [];

			if (list.length === 1 && session?.user.preferences?.projectPrompts) {
				router.replace(`/portal/${encodeURIComponent(list[0].id ?? list[0])}`);
				return;
			}

			setProjects(list);
			setLoading(false);
		})();
	}, [router, session]);

	if (loading) return <Loading title="Loading..." />;

	if (projects.length === 0) return <EmptyState icon={<FolderOpen size={32} />} title="No projects" description="No projects have been assigned to your account." />;

	return (
		<div className="space-y-6">
			<PageHeader icon={<FolderOpen size={20} />} title="Projects" description="Select a project to continue." />

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{projects.map((project) => (
					<Link key={project} href={`/portal/${encodeURIComponent(project)}`}>
						<Card className="p-6 hover:-translate-y-0.5 transition-all cursor-pointer">
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-xl bg-(--active-accent) flex items-center justify-center">
									<FolderOpen size={18} className="text-(--accent)" />
								</div>

								<div>
									<div className="font-medium">{project}</div>

									<div className="text-sm text-(--text-muted)">Open project</div>
								</div>
							</div>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
