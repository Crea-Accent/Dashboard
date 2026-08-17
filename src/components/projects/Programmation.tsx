/** @format */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import ProjectFile, { FileEntry } from '../files/File';
import { useEffect, useRef, useState } from 'react';

import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import FileEditModal from '../files/FileEditModal';
import FileGrid from '../files/FileGrid';
import FileList from '../files/FileList';
import Loading from '../ui/Loading';
import { User } from 'next-auth';
import ViewToggle from '../ui/ViewToggle';
import { usePermissions } from '@/providers/PermissionsProvider';
import { useUpload } from '@/providers/UploadProvider';
import { DebugInfo } from '@/providers/DebugProvider';

function parseDateFromFolderName(name: string) {
	const filename = name.replace(/\.[^.]+$/, '');

	const parts = filename.split('__');

	const datePart = parts.find((p) => /^\d{8}$/.test(p));

	const date = datePart ? Number(datePart) : 0;

	const uploaderRaw = parts[2] ?? '';

	const revisionMatch = uploaderRaw.match(/^(.*)_(\d+)$/);

	const uploader = revisionMatch ? revisionMatch[1] : uploaderRaw;

	const revision = revisionMatch ? Number(revisionMatch[2]) : 0;

	return {
		date,
		uploader,
		revision,
	};
}

function detectProgrammationType(entry: FileEntry): 'DuoTecno' | 'DALI' | 'Loxone' | 'Niko' | 'Siemens' | 'Logs' | 'Other' {
	const lower = entry.name.toLowerCase();

	if (entry.type === 'file') {
		if (lower.endsWith('.nhc2')) return 'Niko';
		if (lower.endsWith('.lsc')) return 'Siemens';
		if (lower.endsWith('.dnc')) return 'DALI';
		if (lower.endsWith('.loxone')) return 'Loxone';
		if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'Logs';
	}

	if (entry.type === 'directory') return 'DuoTecno';

	return 'Other';
}

export default function Programmation({ basePath, client }: { basePath: string; client: string }) {
	const { has } = usePermissions();
	const [view, setView] = useState<'grid' | 'list'>('list');
	const hasWrite = has('projects.write');
	const { uploading, uploadFile } = useUpload();
	const [items, setItems] = useState<FileEntry[]>([]);
	const [users, setUsers] = useState<User[]>([]);

	const dragCounter = useRef(0);
	const [dragging, setDragging] = useState(false);

	const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [loading, setLoading] = useState(true);

	const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const grouped = {
		DuoTecno: items.filter((i) => detectProgrammationType(i) === 'DuoTecno'),
		DALI: items.filter((i) => detectProgrammationType(i) === 'DALI'),
		Loxone: items.filter((i) => detectProgrammationType(i) === 'Loxone'),
		Niko: items.filter((i) => detectProgrammationType(i) === 'Niko'),
		Siemens: items.filter((i) => detectProgrammationType(i) === 'Siemens'),
		Logs: items.filter((i) => detectProgrammationType(i) === 'Logs'),
	};

	const load = async () => {
		setLoading(true);

		const progPath = `${basePath}/${client}/programmation`;
		const [filesRes, usersRes] = await Promise.all([fetch(`/api/files?view=${encodeURIComponent(progPath)}`), fetch('/api/users')]);

		const data: FileEntry[] = await filesRes.json();
		const userData = await usersRes.json();

		setUsers(userData.users ?? []);

		const sorted = data.sort((a, b) => {
			const aMeta = parseDateFromFolderName(a.name);
			const bMeta = parseDateFromFolderName(b.name);

			const dateDiff = bMeta.date - aMeta.date;

			if (dateDiff !== 0) {
				return dateDiff;
			}

			return bMeta.revision - aMeta.revision;
		});

		setItems(sorted);
		setLoading(false);
	};

	const upload = async (file: File) => {
		const isLog = file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.log');
		const newName = isLog ? file.name : client + file.name.substring(file.name.lastIndexOf('.'));

		const projectFile = new File([file], newName, {
			type: file.type,
			lastModified: file.lastModified,
		});

		const success = await uploadFile(projectFile, client, 'programmation');

		if (success) {
			await load();
		}
	};

	const download = async (file: FileEntry) => {
		try {
			const url = `/api/files/download?path=${encodeURIComponent(file.path)}`;

			const a = document.createElement('a');
			a.href = url;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		} catch {}
	};

	const saveFileMetadata = async (file: FileEntry, name: string, comment: string, collaborators: string[]) => {
		const extension = file.name.split('.').pop() ?? '';

		const filename = file.name.replace(new RegExp(`\\.${extension}$`), '');

		const parts = filename.split('__');

		const date = parts[1] ?? '';
		const uploader = parts[2] ?? '';

		const newFilename = [name, date, uploader, collaborators.join('-'), comment].join('__') + '.' + extension;

		await fetch('/api/files', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				oldPath: file.path,
				newName: newFilename,
			}),
		});

		await load();
	};

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const res = await fetch('/api/settings/projects');
				const s = await res.json();
			} catch {}
		};

		loadSettings();
	}, []);

	useEffect(() => {
		(() => {
			load();
		})();
	}, [basePath, client]);

	if (loading) return <Loading title="Loading programmation files" />;

	return (
		<section
			className="space-y-6 relative"
			onDragEnter={(e) => {
				if (!hasWrite) return;
				e.preventDefault();
				dragCounter.current++;
				setDragging(true);
			}}
			onDragOver={(e) => {
				if (!hasWrite) return;
				e.preventDefault();
			}}
		>
			<DebugInfo>
				<div>Files loaded: {items.length}</div>
				<div>
					Detected groups:{' '}
					{Object.entries(grouped)
						.filter(([_, arr]) => arr.length > 0)
						.map(([k, arr]) => `${k} (${arr.length})`)
						.join(', ')}
				</div>
			</DebugInfo>

			<input ref={inputRef} type="file" accept=".zip,.dnc,.loxone,.nhc2,.lsc,.txt,.log" className="hidden" onChange={(e) => e.target.files && upload(e.target.files[0])} />

			<div className="rounded-3xl p-6 space-y-6 bg-(--foreground)">
				<AnimatePresence mode="popLayout">
					{/* Upload */}
					<div key="header" className="flex justify-end gap-2">
						<ViewToggle value={view} onChange={setView} />

						{hasWrite && (
							<Button icon={<Upload size={14} />} onClick={() => inputRef.current?.click()} disabled={uploading}>
								{uploading ? 'Uploading…' : 'Upload'}
							</Button>
						)}
					</div>

					{/* Groups */}
					{Object.entries(grouped).map(([type, entries], i) => {
						if (!entries.length) return null;

						const latest = entries[0];
						const older = entries.slice(1);
						const isExpanded = expandedGroups.includes(type);

						return (
							<div key={type + i} className="space-y-3">
								<div className="flex items-center gap-2">
									<h3 className="text-sm font-semibold">{type}</h3>
								</div>

								{view === 'grid' ? (
									<>
										<div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
											<ProjectFile
												file={latest}
												users={users}
												onDownload={() => download(latest)}
												onEdit={() => {
													setEditingFile(latest);
													setEditModalOpen(true);
												}}
											/>

											{older.length > 0 && (
												<div
													onClick={() => setExpandedGroups((prev) => (prev.includes(type) ? prev.filter((g) => g !== type) : [...prev, type]))}
													className="rounded-3xl min-h-45 flex items-center justify-center cursor-pointer bg-(--accent)/10 border-2 border-(--accent)/70 transition	hover:opacity-80"
												>
													<div className="text-center">
														{isExpanded ? <ChevronLeft className="mx-auto w-8 h-8" /> : <ChevronRight className="mx-auto w-8 h-8" />}

														<div className="text-xs mt-2 text-zinc-500">{older.length} older</div>
													</div>
												</div>
											)}
										</div>

										<AnimatePresence>
											{isExpanded && (
												<motion.div key="expanded-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
													<FileGrid
														files={older}
														users={users}
														onDownload={download}
														onEdit={(file) => {
															setEditingFile(file);
															setEditModalOpen(true);
														}}
														permission="projects.write"
													/>
												</motion.div>
											)}
										</AnimatePresence>
									</>
								) : (
									<>
										<FileList
											files={[latest]}
											users={users}
											onDownload={download}
											onEdit={(file) => {
												setEditingFile(file);
												setEditModalOpen(true);
											}}
											permission="projects.write"
										/>

										{older.length > 0 && (
											<Button
												className="w-full"
												variant="primary-ghost"
												onClick={() => setExpandedGroups((prev) => (prev.includes(type) ? prev.filter((g) => g !== type) : [...prev, type]))}
											>
												{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}

												<span>{isExpanded ? 'Hide older' : `Show older (${older.length})`}</span>
											</Button>
										)}

										<AnimatePresence>
											{isExpanded && (
												<motion.div
													key="expanded-list"
													initial={{ opacity: 0, height: 0 }}
													animate={{ opacity: 1, height: 'auto' }}
													exit={{ opacity: 0, height: 0 }}
													className="overflow-hidden"
												>
													<FileList
														files={older}
														users={users}
														onDownload={download}
														onEdit={(file) => {
															setEditingFile(file);
															setEditModalOpen(true);
														}}
														permission="projects.write"
													/>
												</motion.div>
											)}
										</AnimatePresence>
									</>
								)}
							</div>
						);
					})}

					{/* Empty */}
					{!loading && Object.values(grouped).every((arr) => arr.length === 0) && (
						<motion.div key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
							<EmptyState title="No Programmation Files" description="Upload DuoTecno, Niko, Siemens, DALI, Loxone projects or Logs to get started." />
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<FileEditModal
				open={editModalOpen}
				file={editingFile}
				users={users}
				onClose={() => {
					setEditModalOpen(false);
					setEditingFile(null);
				}}
				onSave={async (name, comment, collaborators) => {
					if (!editingFile) {
						return;
					}

					await saveFileMetadata(editingFile, name, comment, collaborators);

					setEditModalOpen(false);
					setEditingFile(null);
				}}
			/>

			{dragging && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onDragLeave={() => {
						dragCounter.current--;
						if (dragCounter.current <= 0) {
							setDragging(false);
						}
					}}
					onDrop={async (e) => {
						e.preventDefault();
						dragCounter.current = 0;
						setDragging(false);

						const dropped = Array.from(e.dataTransfer.files).filter((file) => {
							const name = file.name.toLowerCase();
							return (
								name.endsWith('.zip') ||
								name.endsWith('.dnc') ||
								name.endsWith('.loxone') ||
								name.endsWith('.nhc2') ||
								name.endsWith('.lsc') ||
								name.endsWith('.txt') ||
								name.endsWith('.log')
							);
						});

						if (dropped.length === 0) return;

						for (const file of dropped) {
							await upload(file);
						}
					}}
					className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center"
				>
					<div className="p-12 text-center bg-(--foreground) rounded-2xl shadow-xl border border-(--border)/10 pointer-events-none">
						<div className="space-y-3">
							<Upload size={48} className="mx-auto text-(--accent)" />
							<h2 className="text-xl font-semibold">Drop programmation files</h2>
							<p className="text-sm text-(--text-muted)">Release your files anywhere to upload them.</p>
						</div>
					</div>
				</motion.div>
			)}
		</section>
	);
}
