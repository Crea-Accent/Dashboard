/** @format */
'use client';

import { AlertCircle, AlertTriangle, CheckCircle, HardDrive, Info, Loader2, RefreshCw, Save, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Loading from '@/components/ui/Loading';
import PageHeader from '@/components/ui/PageHeader';

type VersionInfo = {
	localVersion: string;
	remoteVersion: string;
	upToDate: boolean;
	error?: string;
};

type FilesSettings = {
	path?: string;
};

export default function GeneralSettings() {
	const [info, setInfo] = useState<VersionInfo | null>(null);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);
	const [logs, setLogs] = useState<string[]>([]);

	const [filesSettings, setFilesSettings] = useState<FilesSettings>({
		path: '',
	});

	const [savingPath, setSavingPath] = useState(false);

	async function checkVersion() {
		try {
			const res = await fetch('/api/version', {
				cache: 'no-store',
			});

			setInfo(await res.json());
		} catch {
			setInfo({
				localVersion: '-',
				remoteVersion: '-',
				upToDate: false,
				error: 'Unable to check for updates.',
			});
		}

		setLoading(false);
	}

	function runUpdate() {
		setUpdating(true);
		setLogs([]);

		const source = new EventSource('/api/update');

		source.onmessage = ({ data }) => {
			setLogs((prev) => [...prev, data]);

			if (data.toLowerCase().includes('update complete')) {
				source.close();

				setTimeout(() => {
					window.location.href = window.location.pathname + '?v=' + Date.now();
				}, 3000);
			}
		};

		source.onerror = () => {
			source.close();
			setUpdating(false);
		};
	}

	function messageStyle(message: string) {
		const text = message.toLowerCase();

		if (text.includes('error'))
			return {
				icon: AlertCircle,
				color: 'text-red-500',
			};

		if (text.includes('warn'))
			return {
				icon: AlertTriangle,
				color: 'text-yellow-500',
			};

		if (text.includes('complete') || text.includes('success'))
			return {
				icon: CheckCircle,
				color: 'text-green-500',
			};

		return {
			icon: Info,
			color: 'text-(--accent)',
		};
	}

	async function loadFilesSettings() {
		const res = await fetch('/api/settings/files');
		const data = await res.json();

		setFilesSettings({
			path: '',
			...data,
		});
	}

	async function saveFilesPath() {
		setSavingPath(true);

		await fetch('/api/settings/files', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(filesSettings),
		});

		setSavingPath(false);
	}

	useEffect(() => {
		checkVersion();
		loadFilesSettings();
	}, []);

	if (loading) {
		return <Loading title='General' description='Loading system settings...' />;
	}

	return (
		<div className='space-y-6'>
			<PageHeader icon={<SlidersHorizontal />} title='General' description='System information and global configuration.' />

			<Card className='p-6 space-y-6'>
				<div className='flex items-center justify-between'>
					<div>
						<h3 className='font-semibold'>Application Version</h3>
						<p className='text-sm text-(--text-muted)'>Check for updates and install the latest release.</p>
					</div>

					<Button variant='secondary' icon={<RefreshCw size={16} />} onClick={checkVersion}>
						Refresh
					</Button>
				</div>

				{info?.error ? (
					<div className='text-red-500 text-sm'>{info.error}</div>
				) : (
					<>
						<div className='grid grid-cols-2 gap-4'>
							<div>
								<div className='text-sm text-(--text-muted)'>Installed</div>

								<div className='font-medium'>{info?.localVersion}</div>
							</div>

							<div>
								<div className='text-sm text-(--text-muted)'>Latest</div>

								<div className='font-medium'>{info?.remoteVersion}</div>
							</div>
						</div>

						<div className='flex flex-wrap items-center gap-3'>
							{info?.upToDate ? (
								<div className='flex items-center gap-2 text-green-500 mr-auto'>
									<CheckCircle size={18} />
									Application is up to date.
								</div>
							) : (
								<>
									<div className='flex items-center gap-2 text-yellow-500'>
										<AlertCircle size={18} />
										Update available.
									</div>

									<Button icon={updating ? <Loader2 size={16} className='animate-spin' /> : <RefreshCw size={16} />} onClick={runUpdate} disabled={updating} className='mr-auto'>
										{updating ? 'Updating...' : 'Install Update'}
									</Button>
								</>
							)}

							<Button variant='secondary' icon={<RefreshCw size={16} />} onClick={() => fetch('/api/system/restart', { method: 'POST' })}>
								Restart Service
							</Button>

							<Button variant='danger' icon={<AlertTriangle size={16} />} onClick={() => { if(confirm('Are you sure you want to reboot the entire machine?')) fetch('/api/system/reboot', { method: 'POST' }); }}>
								Reboot Machine
							</Button>
						</div>

						{logs.length > 0 && (
							<Card className='p-4 space-y-2 bg-(--foreground)'>
								{logs.map((log, i) => {
									const meta = messageStyle(log);
									const Icon = meta.icon;

									return (
										<div key={i} className='flex gap-2 text-sm'>
											<Icon size={16} className={meta.color} />

											<span className='font-mono'>{log}</span>
										</div>
									);
								})}
							</Card>
						)}
					</>
				)}
			</Card>

			<Card className='p-6 space-y-6'>
				<div>
					<h3 className='font-semibold'>Files Root</h3>

					<p className='text-sm text-(--text-muted)'>Base directory used by the file explorer.</p>
				</div>

				<Input
					label='Root Folder'
					icon={<HardDrive size={16} />}
					placeholder='D:\Shared'
					value={filesSettings.path ?? ''}
					onChange={(e) =>
						setFilesSettings({
							...filesSettings,
							path: e.target.value,
						})
					}
				/>

				<div className='flex justify-end'>
					<Button icon={<Save size={16} />} onClick={saveFilesPath} loading={savingPath}>
						Save Changes
					</Button>
				</div>
			</Card>
		</div>
	);
}
