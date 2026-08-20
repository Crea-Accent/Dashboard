/** @format */
'use client';

import { CheckCircle2, Circle, ClipboardList, Clock, Edit3, FolderOpen, Search, Package, Filter, Ban } from 'lucide-react';
import { NotPermitted, usePermissions } from '@/providers/PermissionsProvider';
import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CompleteTaskModal from '@/components/projects/tickets/CompleteTaskModal';
import EditTaskModal from '@/components/projects/tickets/EditTaskModal';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import File from '@/components/files/File';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import Loading from '@/components/ui/Loading';
import MultiSelector from '@/components/ui/MultiSelector';
import PageHeader from '@/components/ui/PageHeader';
import Toggle from '@/components/ui/Toggle';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';

type Task = {
	id: string;
	description: string;
	technician: string;
	importance: number;
	requiresPicture?: boolean;
	state: 'unfinished' | 'finished' | 'canceled';
	imagePath?: string;
	finishedImagePath?: string;
	completedBy?: string;
	proofDescription?: string;
	ticketId: string;
	ticketName: string;
	projectName: string;
	ticketCreatedAt: string;
	ticketOpenedBy: string;
	requiresMaterials?: boolean;
	materialAssignee?: string;
	materialState?: 'needs_ordering' | 'ordered' | 'in_stock';
	materialOrderedBy?: string;
	materialStockedBy?: string;
	cancelReason?: string;
};

export default function TasksPage() {
	const { data: session } = useSession();
	const { has } = usePermissions();
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
	const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
	const [materialStateConfirm, setMaterialStateConfirm] = useState<{
		task: Task;
		newState: 'ordered' | 'in_stock';
	} | null>(null);

	const [query, setQuery] = useState('');
	const [stateFilters, setStateFilters] = useState<string[]>(['unfinished']);
	const [materialStatusFilters, setMaterialStatusFilters] = useState<string[]>([]);
	const [showFilters, setShowFilters] = useState(false);
	const [seeAllTasks, setSeeAllTasks] = useState(false);
	const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
	const [allUsers, setAllUsers] = useState<{ label: string; value: string }[]>([]);
	const [loadingUsers, setLoadingUsers] = useState(false);

	const username = session?.user?.name || session?.user?.email || '';

	const load = async () => {
		if (!username) return;
		try {
			setLoading(true);
			const url = seeAllTasks ? '/api/tasks?all=true' : `/api/tasks?technician=${encodeURIComponent(username)}`;
			const res = await fetch(url);
			if (res.ok) {
				const data = await res.json();
				setTasks(data.tasks || []);
			}
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (session) {
			load();
		}
	}, [session, seeAllTasks]);

	useEffect(() => {
		if (has('tasks.write') && seeAllTasks && allUsers.length === 0) {
			setLoadingUsers(true);
			fetch('/api/users')
				.then((res) => res.json())
				.then((data) => {
					if (data.users) {
						setAllUsers([
							{ label: 'Unassigned', value: 'unassigned', color: 'var(--border)' },
							...data.users.map((u: any) => ({
								label: u.name || u.email,
								value: u.name || u.email,
								color: 'var(--accent)',
							})),
						]);
					}
				})
				.finally(() => setLoadingUsers(false));
		}
	}, [seeAllTasks, has, allUsers.length]);

	const updateMaterialState = async (task: Task, newState: 'needs_ordering' | 'ordered' | 'in_stock') => {
		const extraFields: any = {};
		if (newState === 'ordered') extraFields.materialOrderedBy = username;
		if (newState === 'in_stock') extraFields.materialStockedBy = username;

		const updatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, materialState: newState, ...extraFields } : t));
		setTasks(updatedTasks);

		try {
			const res = await fetch(`/api/projects/tickets?client=${encodeURIComponent(task.projectName)}`);
			if (res.ok) {
				const data = await res.json();
				const ticket = data.tickets?.find((t: any) => t.id === task.ticketId);
				if (ticket) {
					const updatedPOIs = ticket.pois.map((poi: any) => (poi.id === task.id ? { ...poi, materialState: newState, ...extraFields } : poi));
					await fetch('/api/projects/tickets', {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							client: task.projectName,
							ticketId: task.ticketId,
							updates: { pois: updatedPOIs },
						}),
					});
				}
			}
		} catch (error) {
			console.error(error);
		}
	};

	const markPOIDone = async (task: Task, finishedImagePath?: string, completedBy?: string, proofDescription?: string) => {
		// Optimistic update
		const updatedTasks = tasks.map((t) =>
			t.id === task.id
				? {
						...t,
						state: 'finished' as const,
						finishedImagePath,
						completedBy,
						proofDescription,
					}
				: t
		);
		setTasks(updatedTasks);

		// We need to fetch the specific ticket to update it correctly because our api needs the whole POI array
		try {
			const res = await fetch(`/api/projects/tickets?client=${encodeURIComponent(task.projectName)}`);
			if (res.ok) {
				const data = await res.json();
				const ticket = data.tickets?.find((t: any) => t.id === task.ticketId);
				if (ticket) {
					const updatedPOIs = ticket.pois.map((poi: any) =>
						poi.id === task.id
							? {
									...poi,
									state: 'finished' as const,
									finishedImagePath,
									completedBy,
									proofDescription,
								}
							: poi
					);

					await fetch('/api/projects/tickets', {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							client: task.projectName,
							ticketId: task.ticketId,
							updates: { pois: updatedPOIs },
						}),
					});
				}
			}
		} catch (error) {
			console.error('Failed to mark task as done', error);
		}

		await load();
	};

	const filteredTasks = tasks.filter((task) => {
		if (query && !task.description.toLowerCase().includes(query.toLowerCase()) && !task.projectName.toLowerCase().includes(query.toLowerCase())) return false;
		if (stateFilters.length > 0 && !stateFilters.includes(task.state)) return false;
		if (materialStatusFilters.length > 0) {
			const effectiveMatState = task.requiresMaterials ? task.materialState || 'needs_ordering' : 'none';
			if (!materialStatusFilters.includes(effectiveMatState)) return false;
		}
		if (seeAllTasks && selectedUsers.length > 0) {
			const isUnassigned = !task.technician || task.technician.trim() === '';
			const matchesUser = selectedUsers.includes(task.technician);
			const matchesUnassigned = selectedUsers.includes('unassigned') && isUnassigned;

			if (!matchesUser && !matchesUnassigned) return false;
		}
		return true;
	});

	if (loading) return <Loading title="Loading tasks" />;

	return (
		<NotPermitted any={['tasks.read', 'tasks.write']}>
			<motion.div className="space-y-6">
				<PageHeader icon={<ClipboardList size={20} />} title="My Tasks" description="View and manage tasks assigned to you across all projects" />

				<div className="flex flex-col gap-3">
					<div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
						<div className="flex-1 w-full sm:w-auto">
							<Input icon={<Search size={16} />} placeholder="Search tasks or projects..." value={query} onChange={(e) => setQuery(e.target.value)} />
						</div>
						<div className="flex gap-2 shrink-0">
							<Button variant="secondary" icon={<Filter size={16} />} onClick={() => setShowFilters(!showFilters)} />
						</div>
					</div>

					<div className={`flex gap-2 flex-row flex-wrap w-full transition-all ${showFilters ? 'flex' : 'hidden'}`}>
						{has('tasks.write') && (
							<div className="flex items-center bg-(--foreground) border border-(--border)/20 rounded-xl px-4 h-10.5 shadow-sm min-w-[140px] sm:w-40 sm:flex-none xl:w-48">
								<Toggle checked={seeAllTasks} onChange={setSeeAllTasks} label="View All Tasks" />
							</div>
						)}
						{seeAllTasks && (
							<MultiSelector
								className="flex-1 min-w-[140px] sm:w-40 sm:flex-none xl:w-48"
								placeholder={loadingUsers ? 'Loading Users...' : 'Filter by User'}
								value={selectedUsers}
								onChange={setSelectedUsers}
								options={allUsers}
							/>
						)}
						<MultiSelector
							className="flex-1 min-w-[140px] sm:w-40 sm:flex-none xl:w-48"
							placeholder="Task Status"
							value={stateFilters}
							onChange={setStateFilters}
							options={[
								{
									label: 'Uncompleted',
									value: 'unfinished',
									color: 'var(--accent)',
								},
								{
									label: 'Completed',
									value: 'finished',
									color: 'var(--green-500, #22c55e)',
								},
							]}
						/>
						<MultiSelector
							className="flex-1 min-w-[140px] sm:w-40 sm:flex-none xl:w-48"
							placeholder="Material Status"
							value={materialStatusFilters}
							onChange={setMaterialStatusFilters}
							options={[
								{ label: 'Needs Ordering', value: 'needs_ordering', color: 'var(--orange-500, #f97316)' },
								{ label: 'Ordered', value: 'ordered', color: 'var(--blue-500, #3b82f6)' },
								{ label: 'In Stock', value: 'in_stock', color: 'var(--green-500, #22c55e)' },
								{ label: 'No Materials Needed', value: 'none', color: 'var(--text-muted)' },
							]}
						/>
					</div>
				</div>

				{filteredTasks.length === 0 ? (
					<EmptyState title="No Tasks Found" description="You don't have any tasks matching your filters." />
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{filteredTasks.map((task, i) => (
							<motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="min-w-0">
								<Card className="flex flex-col h-full hover:border-(--accent) transition-colors overflow-hidden min-w-0">
									<div className="p-4 flex-1 space-y-4 min-w-0">
										<div className="flex items-start justify-between gap-2 min-w-0">
											<div className="flex items-center gap-2 text-sm text-(--text-muted) font-medium min-w-0">
												<FolderOpen size={16} className="shrink-0" />
												<Link href={`/dashboard/projects/${encodeURIComponent(task.projectName)}`} className="hover:text-(--accent) transition-colors truncate">
													{task.projectName}
												</Link>
											</div>
											<span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 bg-zinc-500/10 text-zinc-500 font-mono">#{task.importance || '-'}</span>
										</div>

										<div className={`text-sm wrap-break-word whitespace-normal space-y-1`}>
											<p className={`${task.state === 'finished' || task.state === 'canceled' ? 'line-through text-(--text-muted)' : ''}`}>{task.description}</p>
											{task.state === 'finished' && task.completedBy && <p className="text-xs font-medium text-green-500">Completed by: {task.completedBy}</p>}
											{task.state === 'canceled' && <p className="text-xs font-medium text-red-500">Not Needed: {task.cancelReason || 'No reason provided'}</p>}
										</div>

										{task.imagePath && (
											<div className="relative w-full overflow-hidden min-w-0">
												<File
													file={{
														name: task.imagePath.split(/[/\\]/).pop() || 'POI.jpg',
														path: task.imagePath,
														type: 'file',
													}}
													image
												/>
											</div>
										)}

										{task.finishedImagePath && (
											<div className="relative w-full overflow-hidden min-w-0">
												<File
													file={{
														name: task.finishedImagePath.split(/[/\\]/).pop() || 'Proof.jpg',
														path: task.finishedImagePath,
														type: 'file',
													}}
													image
												/>
												<div className="absolute top-2 right-2 bg-green-500/90 backdrop-blur-md text-white px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm pointer-events-none">
													<CheckCircle2 size={12} />
													Proof
												</div>
											</div>
										)}

										{task.proofDescription && (
											<div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/50 text-sm italic text-zinc-600 dark:text-zinc-400">
												{task.proofDescription}
											</div>
										)}

										<div className="text-xs text-[var(--text-muted)] flex items-center gap-2 min-w-0 flex-wrap">
											<Clock size={12} className="shrink-0" />
											<span className="truncate min-w-0 flex-1">
												Opened {new Date(task.ticketCreatedAt).toLocaleDateString()} by {task.ticketOpenedBy}
											</span>
										</div>

										{task.requiresMaterials && (
											<div
												className={`mt-2 p-2 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
													task.materialState === 'in_stock'
														? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
														: task.materialState === 'ordered'
															? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
															: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400'
												}`}
											>
												<span className="text-xs font-semibold flex items-center gap-1.5">
													Materials:{' '}
													{task.materialState === 'ordered'
														? `Ordered by ${task.materialOrderedBy || task.materialAssignee || 'Unassigned'}`
														: task.materialState === 'in_stock'
															? `In Stock (received by ${task.materialStockedBy || task.materialAssignee || 'Unassigned'})`
															: `Needs Ordering (assigned to ${task.materialAssignee || 'Unassigned'})`}
												</span>
												{task.state !== 'finished' && task.state !== 'canceled' && (!task.materialState || task.materialState === 'needs_ordering') ? (
													<Button
														size="sm"
														variant="secondary"
														className="h-7 text-xs px-2 bg-[var(--background)] shadow-sm"
														disabled={!(username === task.materialAssignee || has('tasks.write'))}
														onClick={() => setMaterialStateConfirm({ task, newState: 'ordered' })}
													>
														Mark as Ordered
													</Button>
												) : task.state !== 'finished' && task.state !== 'canceled' && task.materialState === 'ordered' ? (
													<Button
														size="sm"
														variant="secondary"
														className="h-7 text-xs px-2 bg-[var(--background)] shadow-sm"
														disabled={!(username === task.materialAssignee || has('tasks.write'))}
														onClick={() => setMaterialStateConfirm({ task, newState: 'in_stock' })}
													>
														Mark as In Stock
													</Button>
												) : null}
											</div>
										)}
									</div>

									<div className="p-3 border-t border-[var(--border)]/10 bg-[var(--background)] flex items-center justify-between min-w-0 gap-2">
										<div className="flex items-center gap-2">
											<div className="text-xs font-medium text-[var(--text-muted)]">
												{task.state === 'finished' ? 'Completed' : task.state === 'canceled' ? 'Not Needed' : 'Pending'}
											</div>
											{has('tasks.write') && (
												<button onClick={() => setTaskToEdit(task)} className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1" title="Edit Task">
													<Edit3 size={14} />
												</button>
											)}
										</div>
										<Button
											size="sm"
											variant={task.state === 'finished' || task.state === 'canceled' ? 'ghost' : 'primary'}
											disabled={task.state === 'finished' || task.state === 'canceled' || (task.requiresMaterials && task.materialState !== 'in_stock')}
											onClick={() => setTaskToComplete(task)}
											icon={
												task.state === 'finished' ? (
													<CheckCircle2 size={16} className="text-green-500" />
												) : task.state === 'canceled' ? (
													<Ban size={16} className="text-red-500" />
												) : (
													<Circle size={16} />
												)
											}
											title={
												task.state === 'canceled'
													? 'Task marked as Not Needed'
													: task.requiresMaterials && task.materialState !== 'in_stock'
														? 'Materials are not in stock yet.'
														: ''
											}
										>
											{task.state === 'finished' ? 'Done' : task.state === 'canceled' ? 'Disregarded' : 'Mark as Done'}
										</Button>
									</div>
								</Card>
							</motion.div>
						))}
					</div>
				)}

				{taskToComplete && (
					<CompleteTaskModal
						open={true}
						client={taskToComplete.projectName}
						poiId={taskToComplete.id}
						requiresPicture={taskToComplete.requiresPicture}
						ticketId={taskToComplete.ticketId || taskToComplete.id.split('_')[0]}
						users={[]}
						onClose={() => setTaskToComplete(null)}
						onComplete={(imagePath, completedBy, proofDescription) => markPOIDone(taskToComplete, imagePath, completedBy, proofDescription)}
					/>
				)}

				{taskToEdit && (
					<EditTaskModal
						open={true}
						task={taskToEdit}
						onClose={() => setTaskToEdit(null)}
						onSave={async () => {
							await load();
						}}
					/>
				)}

				<Modal
					open={!!materialStateConfirm}
					title="Confirm Material Status"
					size="md"
					onClose={() => setMaterialStateConfirm(null)}
					footer={
						<>
							<Button variant="secondary" onClick={() => setMaterialStateConfirm(null)}>
								Cancel
							</Button>
							<Button
								onClick={() => {
									if (materialStateConfirm) {
										updateMaterialState(materialStateConfirm.task, materialStateConfirm.newState);
										setMaterialStateConfirm(null);
									}
								}}
							>
								Confirm
							</Button>
						</>
					}
				>
					<div className="py-2 text-sm text-[var(--text)]">
						Are you sure you want to mark these materials as <strong>{materialStateConfirm?.newState === 'ordered' ? 'Ordered' : 'In Stock'}</strong>?
					</div>
				</Modal>
			</motion.div>
		</NotPermitted>
	);
}
