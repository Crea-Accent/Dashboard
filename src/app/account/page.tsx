/** @format */
'use client';

import { Lock, Moon, Settings2, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Toggle from '@/components/ui/Toggle';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/providers/ThemeProvider';

export default function Page() {
	const { data: session } = useSession();
	const { theme, setTheme } = useTheme();

	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');

	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const [projectPromptEnabled, setProjectPromptEnabled] = useState<boolean>(session?.user?.preferences?.projectPrompts ?? true);
	const [debugMode, setDebugMode] = useState<boolean>(session?.user?.preferences?.debugMode ?? false);
	const [defaultView, setDefaultView] = useState<'grid' | 'list'>((session?.user?.preferences?.defaultView as 'grid' | 'list') ?? 'grid');

	useEffect(() => {
		setProjectPromptEnabled(session?.user?.preferences?.projectPrompts ?? true);

		setDebugMode(session?.user?.preferences?.debugMode ?? false);

		setDefaultView((session?.user?.preferences?.defaultView as 'grid' | 'list') ?? 'grid');
	}, [session]);

	if (!session) {
		return null;
	}

	async function changePassword() {
		setSaving(true);
		setMessage(null);

		try {
			const res = await fetch('/api/users', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					currentPassword,
					newPassword,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				setMessage(data.error || 'Failed');
				return;
			}

			setMessage('Password updated successfully');
			setCurrentPassword('');
			setNewPassword('');
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-8">
			<div className="grid gap-6 lg:grid-cols-2">
				<Card className="p-6">
					<div className="flex items-center gap-3 mb-4">
						<User size={18} className="text-(--accent)" />

						<h2 className="text-lg font-semibold">Account</h2>
					</div>

					<div className="space-y-3 text-sm">
						<div>
							<div className="text-(--text-muted)">Name</div>

							<div className="font-semibold">{session.user?.name}</div>
						</div>

						<div>
							<div className="text-(--text-muted)">Email</div>

							<div className="font-semibold">{session.user?.email}</div>
						</div>
					</div>
				</Card>

				<Card className="space-y-6 p-6">
					<div className="flex items-center gap-3">
						<Moon size={18} className="text-(--accent)" />

						<h2 className="text-lg font-semibold">Appearance</h2>
					</div>

					<div className="flex flex-wrap gap-2">
						{(['light', 'dark', 'system'] as const).map((mode) => (
							<Button key={mode} variant={theme === mode ? 'primary' : 'secondary'} onClick={() => setTheme(mode)}>
								{mode}
							</Button>
						))}
					</div>
				</Card>
			</div>

			<Card className="p-6">
				<div className="flex items-center gap-3">
					<Settings2 size={18} className="text-(--accent)" />

					<h2 className="text-lg font-semibold">Preferences</h2>
				</div>

				<div className="space-y-8">
					<Toggle
						label="Nearby Project Detection"
						description="Prompt to open a project when arriving at a known installation location."
						checked={projectPromptEnabled}
						onChange={async (value) => {
							setProjectPromptEnabled(value);

							try {
								await fetch('/api/users', {
									method: 'PUT',
									headers: {
										'Content-Type': 'application/json',
									},
									body: JSON.stringify({
										preferences: {
											projectPrompts: value,
										},
									}),
								});
							} catch (error) {
								console.error(error);
							}
						}}
					/>

					<Toggle
						label="Debug mode"
						description="See debug options"
						checked={debugMode}
						onChange={async (value) => {
							setDebugMode(value);

							try {
								await fetch('/api/users', {
									method: 'PUT',
									headers: {
										'Content-Type': 'application/json',
									},
									body: JSON.stringify({
										preferences: {
											debugMode: value,
										},
									}),
								});
							} catch (error) {
								console.error(error);
							}
						}}
					/>

					<div>
						<div className="font-medium mb-1">Default View</div>

						<div className="text-sm text-(--text-muted) mb-4">Preferred layout used throughout the platform.</div>

						<div className="flex gap-2">
							<Button
								variant={defaultView === 'list' ? 'primary' : 'secondary'}
								onClick={async () => {
									setDefaultView('list');

									try {
										await fetch('/api/users', {
											method: 'PUT',
											headers: {
												'Content-Type': 'application/json',
											},
											body: JSON.stringify({
												preferences: {
													defaultView: 'list',
												},
											}),
										});
									} catch (error) {
										console.error(error);
									}
								}}
							>
								List
							</Button>

							<Button
								variant={defaultView === 'grid' ? 'primary' : 'secondary'}
								onClick={async () => {
									setDefaultView('grid');

									try {
										await fetch('/api/users', {
											method: 'PUT',
											headers: {
												'Content-Type': 'application/json',
											},
											body: JSON.stringify({
												preferences: {
													defaultView: 'grid',
												},
											}),
										});
									} catch (error) {
										console.error(error);
									}
								}}
							>
								Grid
							</Button>
						</div>
					</div>
				</div>
			</Card>

			<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
				<Card className="p-6 space-y-4">
					<div className="flex items-center gap-3">
						<Lock size={18} className="text-(--accent)" />

						<h2 className="text-lg font-semibold">Security</h2>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<Input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />

						<Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
					</div>

					<div className="flex items-center gap-4">
						<Button loading={saving} onClick={changePassword}>
							Update Password
						</Button>

						{message && <span className="text-sm text-(--text-muted)">{message}</span>}
					</div>
				</Card>
			</motion.div>
		</div>
	);
}
