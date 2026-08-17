/** @format */
'use client';

import { useEffect, useState } from 'react';

import { Save } from 'lucide-react';

type WorkspaceSettings = {
	path?: string;
};

export default function Workspace() {
	const [workspace, setWorkspace] = useState<WorkspaceSettings>({
		path: '',
	});
	const [saving, setSaving] = useState(false);

	/* ---------------- LOAD ---------------- */

	async function loadWorkspace() {
		try {
			const res = await fetch('/api/settings/workspace');
			const data = await res.json();

			setWorkspace({
				path: data.path || '',
			});
		} catch {
			setWorkspace({ path: '' });
		}
	}

	/* ---------------- SAVE ---------------- */

	async function saveWorkspace() {
		setSaving(true);

		await fetch('/api/settings/workspace', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				path: workspace.path,
			}),
		});

		setTimeout(() => setSaving(false), 400);
	}

	useEffect(() => {
		loadWorkspace();
	}, []);

	/* ---------------- UI ---------------- */

	return (
		<div className="max-w-xl space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Workspace</h2>
				<p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Set the root directory for your workspace.</p>
			</div>

			<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
				<input
					className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-(--accent)/20 transition"
					placeholder="D:\\Workspace"
					value={workspace.path || ''}
					onChange={(e) =>
						setWorkspace({
							...workspace,
							path: e.target.value,
						})
					}
				/>

				<div>
					<button
						onClick={saveWorkspace}
						disabled={saving}
						className="h-10 px-4 rounded-lg bg-(--accent) text-white text-sm font-medium flex items-center gap-2 hover:bg-(--hover-accent) disabled:opacity-60 transition"
					>
						<Save size={16} />
						{saving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	);
}
