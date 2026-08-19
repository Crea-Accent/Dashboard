/** @format */
'use client';

import { FileText, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { motion } from 'framer-motion';

type TemplatesSettings = {
	path?: string;
};

export default function TemplatesSettings() {
	const [settings, setSettings] = useState<TemplatesSettings>({
		path: '',
	});

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		async function load() {
			const res = await fetch('/api/settings/templates');
			const data = await res.json();

			setSettings({
				path: '',
				...data,
			});

			setLoading(false);
		}

		load();
	}, []);

	async function save() {
		setSaving(true);

		await fetch('/api/settings/templates', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(settings),
		});

		setTimeout(() => setSaving(false), 500);
	}

	if (loading) {
		return <div className="text-sm text-(--text-muted)">Loading...</div>;
	}

	return (
		<div className="space-y-6">
			{/* Header */}

			<div>
				<h2 className="text-lg font-semibold">Templates</h2>

				<p className="text-sm text-(--text-muted) mt-1">Manage where document templates are stored and made available for download.</p>
			</div>

			{/* Storage */}

			<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
				<Card className="p-6 space-y-6">
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-xl bg-(--active-accent) flex items-center justify-center">
							<FileText size={18} className="text-(--accent)" />
						</div>

						<div>
							<h3 className="font-semibold">Templates Library</h3>

							<p className="text-sm text-(--text-muted)">Choose where template files are stored.</p>
						</div>
					</div>

					<Input
						label="Root Folder"
						placeholder="D:\\Templates"
						value={settings.path ?? ''}
						onChange={(e) =>
							setSettings({
								...settings,
								path: e.target.value,
							})
						}
					/>

					<p className="text-sm text-(--text-muted)">All files within this folder will be available for download on the Templates page.</p>

					<div className="flex justify-end">
						<Button icon={<Save size={16} />} loading={saving} onClick={save}>
							Save Changes
						</Button>
					</div>
				</Card>
			</motion.div>
		</div>
	);
}
