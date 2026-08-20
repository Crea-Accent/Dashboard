/** @format */
'use client';

import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Selector from '@/components/ui/Selector';
import Toggle from '@/components/ui/Toggle';

type Task = {
	id: string;
	description: string;
	technician: string;
	ticketId: string;
	ticketName: string;
	projectName: string;
	[key: string]: any;
};

type EditTaskModalProps = {
	open: boolean;
	task: Task;
	onClose: () => void;
	onSave: () => Promise<void>;
};

export default function EditTaskModal({ open, task, onClose, onSave }: EditTaskModalProps) {
	const [ticketName, setTicketName] = useState(task.ticketName || '');
	const [description, setDescription] = useState(task.description || '');
	const [technician, setTechnician] = useState(task.technician || '');
	const [requiresMaterials, setRequiresMaterials] = useState(task.requiresMaterials || false);
	const [materialAssignee, setMaterialAssignee] = useState(task.materialAssignee || '');
	const [materialState, setMaterialState] = useState(task.materialState || 'needs_ordering');

	const [cancelReason, setCancelReason] = useState(task.cancelReason || '');
	const [isCanceling, setIsCanceling] = useState(false);

	const [users, setUsers] = useState<any[]>([]);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		fetch('/api/users')
			.then((res) => res.json())
			.then((data) => {
				if (data.users) setUsers(data.users);
			});
	}, []);

	const handleSave = async (stateOverride?: string) => {
		try {
			setSaving(true);

			// We need to fetch the full ticket to patch the specific POI inside its POI array
			const res = await fetch(`/api/projects/tickets?client=${encodeURIComponent(task.projectName)}`);
			if (!res.ok) throw new Error('Failed to fetch tickets');
			const data = await res.json();
			const fullTicket = data.tickets?.find((t: any) => t.id === task.ticketId);

			if (!fullTicket) throw new Error('Ticket not found');

			const updatedPOIs = fullTicket.pois.map((poi: any) =>
				poi.id === task.id
					? {
							...poi,
							description,
							technician,
							requiresMaterials,
							materialAssignee,
							materialState,
							state: stateOverride || poi.state,
							cancelReason: stateOverride === 'canceled' || (poi.state === 'canceled' && !stateOverride) ? cancelReason : undefined,
						}
					: poi
			);

			await fetch('/api/projects/tickets', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client: task.projectName,
					ticketId: task.ticketId,
					updates: {
						name: ticketName,
						pois: updatedPOIs,
					},
				}),
			});

			await onSave();
			onClose();
		} catch (error) {
			console.error('Failed to save task:', error);
		} finally {
			setSaving(false);
		}
	};

	if (isCanceling) {
		return (
			<Modal
				open={open}
				title="Cancel Task"
				size="2xl"
				onClose={() => setIsCanceling(false)}
				footer={
					<>
						<Button variant="secondary" onClick={() => setIsCanceling(false)} disabled={saving}>
							Back
						</Button>
						<Button onClick={() => handleSave('canceled')} disabled={saving || !cancelReason.trim()} className="bg-red-500 hover:bg-red-600 text-white border-transparent">
							Confirm Cancellation
						</Button>
					</>
				}
			>
				<div className="space-y-4">
					<p className="text-sm text-[var(--text-muted)]">Please provide a reason why this task is not needed anymore.</p>
					<Input label="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus />
				</div>
			</Modal>
		);
	}

	return (
		<Modal
			open={open}
			title="Edit Task"
			size="2xl"
			onClose={onClose}
			footer={
				<>
					{task.state !== 'canceled' && (
						<div className="flex-1">
							<Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setIsCanceling(true)} disabled={saving}>
								Mark as Not Needed
							</Button>
						</div>
					)}
					{task.state === 'canceled' && (
						<div className="flex-1">
							<Button variant="ghost" className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10" onClick={() => handleSave('unfinished')} disabled={saving}>
								Re-open Task
							</Button>
						</div>
					)}
					<Button variant="secondary" onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button onClick={() => handleSave()} disabled={saving}>
						Save Changes
					</Button>
				</>
			}
		>
			<div className="space-y-4">
				<div className="mb-4">
					<Input label="Ticket Name" value={ticketName} onChange={(e) => setTicketName(e.target.value)} />
					<p className="text-xs text-[var(--text-muted)] mt-1">Warning: Editing this changes the name for all tasks in this ticket.</p>
				</div>

				<Input label="Task Description" value={description} onChange={(e) => setDescription(e.target.value)} />

				<div className="pt-2">
					<label className="text-sm font-medium text-[var(--text)] block mb-2">Assign Technician</label>
					<Selector
						value={technician}
						onChange={(v) => setTechnician(v)}
						options={[
							{ label: 'Unassigned', value: '' },
							...users.map((u) => ({
								label: u.name || u.username || u.id,
								value: u.username || u.name || u.id,
							})),
						]}
					/>
				</div>

				<div className="pt-4 border-t border-[var(--border)] mt-4">
					<Toggle label="Requires Materials" checked={requiresMaterials} onChange={setRequiresMaterials} />
				</div>

				{requiresMaterials && (
					<div className="space-y-4 pt-2">
						<div>
							<label className="text-sm font-medium text-[var(--text)] block mb-2">Material Assignee</label>
							<Selector
								value={materialAssignee}
								onChange={(v) => setMaterialAssignee(v)}
								options={[
									{ label: 'Unassigned', value: '' },
									...users.map((u) => ({
										label: u.name || u.username || u.id,
										value: u.username || u.name || u.id,
									})),
								]}
							/>
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}
