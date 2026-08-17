/** @format */
'use client';

import { CheckSquare, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import Button from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import PageHeader from '../ui/PageHeader';
import Toggle from '../ui/Toggle';

export type TicketTemplatePOI = {
	id: string;
	description: string;
	requiresPicture: boolean;
};

export type TicketTemplate = {
	id: string;
	name: string;
	pois: TicketTemplatePOI[];
};

export default function TasksSettings() {
	const [templates, setTemplates] = useState<TicketTemplate[]>([]);
	const [showModal, setShowModal] = useState(false);
	const [saving, setSaving] = useState(false);
	const [editingTemplate, setEditingTemplate] = useState<TicketTemplate | null>(null);

	const [templateName, setTemplateName] = useState('');
	const [pois, setPois] = useState<TicketTemplatePOI[]>([]);

	async function load() {
		try {
			const res = await fetch('/api/settings/ticket-templates');
			const data = await res.json();
			setTemplates(data.templates || []);
		} catch (e) {
			console.error('Failed to load ticket templates', e);
		}
	}

	useEffect(() => {
		load();
	}, []);

	const handleAddPOI = () => {
		setPois((curr) => [
			...curr,
			{
				id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
				description: '',
				requiresPicture: false,
			},
		]);
	};

	const handleRemovePOI = (id: string) => {
		setPois((curr) => curr.filter((p) => p.id !== id));
	};

	const handlePOIChange = (id: string, field: keyof TicketTemplatePOI, value: any) => {
		setPois((curr) => curr.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
	};

	const openNewTemplate = () => {
		setEditingTemplate(null);
		setTemplateName('');
		setPois([
			{
				id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
				description: '',
				requiresPicture: false,
			},
		]);
		setShowModal(true);
	};

	const openEditTemplate = (template: TicketTemplate) => {
		setEditingTemplate(template);
		setTemplateName(template.name);
		setPois(JSON.parse(JSON.stringify(template.pois))); // Deep copy
		setShowModal(true);
	};

	const saveTemplate = async () => {
		try {
			setSaving(true);
			const id = editingTemplate ? editingTemplate.id : typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

			const newTemplate: TicketTemplate = {
				id,
				name: templateName.trim() || 'Untitled Template',
				pois: pois.filter((p) => p.description.trim() !== ''),
			};

			await fetch('/api/settings/ticket-templates', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newTemplate),
			});

			await load();
			setShowModal(false);
		} catch (error) {
			console.error('Failed to save template', error);
		} finally {
			setSaving(false);
		}
	};

	const deleteTemplate = async (id: string) => {
		if (!confirm('Are you sure you want to delete this template?')) return;
		try {
			await fetch(`/api/settings/ticket-templates?id=${id}`, {
				method: 'DELETE',
			});
			await load();
		} catch (error) {
			console.error('Failed to delete template', error);
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader icon={<CheckSquare size={24} className="text-(--accent)" />} title="Tasks" description="Manage standard ticket templates." />

			<div className="flex justify-end">
				<Button icon={<Plus size={16} />} onClick={openNewTemplate}>
					New Template
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{templates.map((template) => (
					<Card key={template.id} className="p-4 bg-(--background) hover:bg-(--foreground) transition-colors cursor-pointer group" onClick={() => openEditTemplate(template)}>
						<div className="flex items-start justify-between">
							<div className="min-w-0">
								<h3 className="font-medium text-lg truncate flex items-center gap-2">
									<CheckSquare size={18} className="text-(--text-muted)" />
									{template.name}
								</h3>
								<p className="text-sm text-(--text-muted) mt-1">{template.pois.length} points of interest</p>
							</div>
							<button
								onClick={(e) => {
									e.stopPropagation();
									deleteTemplate(template.id);
								}}
								className="p-2 text-(--text-muted) hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
							>
								<Trash2 size={16} />
							</button>
						</div>
					</Card>
				))}
			</div>

			{templates.length === 0 && (
				<EmptyState icon={<CheckSquare size={32} />} title="No templates found" description="Create your first ticket template to easily add standard tasks to projects." />
			)}

			<Modal
				open={showModal}
				onClose={() => setShowModal(false)}
				title={editingTemplate ? 'Edit Template' : 'New Template'}
				size="lg"
				footer={
					<>
						<Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
							Cancel
						</Button>
						<Button onClick={saveTemplate} disabled={saving || !templateName.trim()}>
							{saving ? 'Saving...' : 'Save Template'}
						</Button>
					</>
				}
			>
				<div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
					<Input label="Template Name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Ground Floor Maintenance" />

					<div className="space-y-4">
						<h3 className="font-semibold text-sm text-(--text-muted) uppercase tracking-wider">Points of Interest</h3>

						{pois.map((poi, index) => (
							<div key={poi.id} className="bg-(--foreground) p-4 rounded-2xl border border-(--border)/10 space-y-4 relative">
								{pois.length > 1 && (
									<button onClick={() => handleRemovePOI(poi.id)} className="absolute top-3 right-3 text-(--text-muted) hover:text-red-500 transition-colors">
										<X size={16} />
									</button>
								)}

								<div>
									<Input label="Description" value={poi.description} onChange={(e) => handlePOIChange(poi.id, 'description', e.target.value)} placeholder="Task description..." />
								</div>

								<div className="py-2 border-t border-(--border)/10 mt-2">
									<Toggle
										checked={poi.requiresPicture}
										onChange={(checked) => handlePOIChange(poi.id, 'requiresPicture', checked)}
										label="Require Proof Media"
										description="The technician must upload media when marking this task as done."
									/>
								</div>
							</div>
						))}

						<Button variant="secondary" className="w-full justify-center" icon={<Plus size={16} />} onClick={handleAddPOI}>
							Add Task
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
