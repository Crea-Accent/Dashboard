/** @format */
'use client';

import { FolderOpen, Hand, Info, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import Tabs from '@/components/ui/Tabs';
import { useSession } from 'next-auth/react';
import { useSidebar } from '@/providers/SidebarProvider';

type Project = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	label: string;
	address: {
		street: string;
		number: string;
		suite?: string;
		postalCode: string;
		city: string;
		country: string;
		lat: number;
		lng: number;
	};
	contact: {
		contactPersons: any[];
		phones: any[];
		emails: any[];
	};
	logins: any[];
	notes: string;
	solar: any;
	shareCode: string;
	setup: any[];
	access: string[];
};

export default function Page() {
	const { data: session, status } = useSession();
	const { setOpen } = useSidebar();
	const router = useRouter();
	const params = useParams();

	const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
	const projectId = decodeURIComponent(rawId ?? '');
	const [project, setProject] = useState<Project | null>(null);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState('overview');

	useEffect(() => {
		setOpen(false);

		if (status !== 'authenticated') return;

		(async () => {
			try {
				const res = await fetch(`/api/portal/projects/${encodeURIComponent(projectId)}`);

				if (!res.ok) {
					router.replace('/portal');
					return;
				}

				const data = await res.json();

				if (!data.allowed) {
					router.replace('/portal');
					return;
				}

				setProject(data.project);
			} catch {
				router.replace('/portal');
			} finally {
				setLoading(false);
			}
		})();
	}, [projectId, status, router]);

	if (status === 'loading' || loading) return <Loading title='Loading project...' />;

	if (!session || !project) return null;

	return (
		<div className='p-6 space-y-6'>
			<h1 className='text-2xl font-semibold'>{project.name}</h1>

			<p className='text-(--text-muted)'>{[project.address.suite, project.address.street, project.address.number, project.address.postalCode, project.address.city, project.address.country].filter(Boolean).join(', ')}</p>

			<Tabs
				value={view}
				onChange={setView}
				tabs={[
					{ id: 'overview', label: 'Overview', icon: <Info size={16} /> },
					{ id: 'controls', label: 'Controls', icon: <Hand size={16} /> },
					{ id: 'documents', label: 'Documents', icon: <FolderOpen size={16} /> },
					{ id: 'logins', label: 'Logins', icon: <KeyRound size={16} /> },
				]}
			/>

			{view === 'overview' && (
				<div className='grid gap-6 lg:grid-cols-2'>
					<Card className='p-6 space-y-4'>
						<h2 className='font-semibold'>Project Information</h2>

						<div className='grid grid-cols-[140px_1fr] gap-y-2 text-sm'>
							<div className='text-(--text-muted)'>Address</div>
							<div>{[project.address.suite, project.address.street, project.address.number, project.address.postalCode, project.address.city, project.address.country].filter(Boolean).join(', ')}</div>

							<div className='text-(--text-muted)'>Status</div>
							<div>{project.label || '-'}</div>

							<div className='text-(--text-muted)'>Created</div>
							<div>{new Date(project.createdAt).toLocaleDateString()}</div>

							<div className='text-(--text-muted)'>Updated</div>
							<div>{new Date(project.updatedAt).toLocaleString()}</div>
						</div>
					</Card>
				</div>
			)}

			{view === 'controls' && (
				<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
					{project.setup
						.filter((module) => module.moduleId == 'DTBS-4x')
						.map((button) => {
							return (
								<Card key={button.id} className='p-6 space-y-3'>
									<h3 className='font-medium'>{button.phyiscalAddress}</h3>

									<p className='text-sm text-(--text-muted)'>{button.description}</p>

									<Button>Run</Button>
								</Card>
							);
						})}
				</div>
			)}
		</div>
	);
}
