/** @format */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Pencil, Trash2, Upload } from 'lucide-react';
import ProjectFile, { FileEntry } from '../files/File';
import { useEffect, useRef, useState } from 'react';

import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import FileEditModal from '../files/FileEditModal';
import FileGrid from '../files/FileGrid';
import FileList from '../files/FileList';
import FileUploadModal from '../files/FileUploadModal';
import Input from '../ui/Input';
import Loading from '../ui/Loading';
import Modal from '../ui/Modal';
import { User } from 'next-auth';
import ViewToggle from '../ui/ViewToggle';
import { usePermissions } from '@/providers/PermissionsProvider';
import { DebugInfo } from '@/providers/DebugProvider';
import { useSession } from 'next-auth/react';
import { useUpload } from '@/providers/UploadProvider';

const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.xlsm', '.txt'];

function parseDocumentMetadata(name: string) {
	const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
	const filename = name.replace(/\.[^.]+$/, '');
	const parts = filename.split('__');
	const baseName = parts[0] || filename;

	const datePart = parts.find((p) => /^\d{8}$/.test(p));
	const date = datePart ? Number(datePart) : 0;

	const uploaderRaw = parts[2] ?? '';
	const revisionMatch = uploaderRaw.match(/^(.*)_(\d+)$/);
	const uploader = revisionMatch ? revisionMatch[1] : uploaderRaw;
	const revision = revisionMatch ? Number(revisionMatch[2]) : 0;

	return {
		baseName,
		extension,
		date,
		uploader,
		revision,
	};
}

function getFolderName(file: FileEntry) {
	const parts = file.path.split(/[\\/]/);
	const folder = parts[parts.length - 2];
	if (folder === 'documents') {
		return 'Ungrouped';
	}
	return folder;
}

export default function Documents({ basePath, client }: { basePath: string; client: string }) {
	const inputRef = useRef<HTMLInputElement>(null);

	const { data: session } = useSession();

	const { uploading, uploadFile } = useUpload();
	const { has } = usePermissions();

	const [draggingFile, setDraggingFile] = useState<FileEntry | null>(null);
	const [files, setFiles] = useState<FileEntry[]>([]);
	const [groups, setGroups] = useState<FileEntry[]>([]);
	const [users, setUsers] = useState<User[]>([]);

	const [loading, setLoading] = useState(true);
	const [view, setView] = useState<'grid' | 'list'>('list');

	const dragCounter = useRef(0);
	const [dragging, setDragging] = useState(false);

	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [initialGroup, setInitialGroup] = useState<string>('Ungrouped');
	const [uploadModalOpen, setUploadModalOpen] = useState(false);

	const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
	const [editModalOpen, setEditModalOpen] = useState(false);

	const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

	const [newGroupOpen, setNewGroupOpen] = useState(false);
	const [newGroupName, setNewGroupName] = useState('');
	const [renameGroupOpen, setRenameGroupOpen] = useState(false);
	const [groupToRename, setGroupToRename] = useState<FileEntry | null>(null);
	const [deleteGroup, setDeleteGroup] = useState<FileEntry | null>(null);
	const [deletingGroup, setDeletingGroup] = useState(false);

	const canWrite = has('projects.write');

	const load = async () => {
		try {
			setLoading(true);

			const documentsPath = `${basePath}/${client}/documents`;

			const [filesRes, usersRes] = await Promise.all([fetch(`/api/files?view=${encodeURIComponent(documentsPath)}&recursive=1`), fetch('/api/users')]);

			const fileData: FileEntry[] = await filesRes.json();
			const userData = await usersRes.json();

			setUsers(userData.users ?? []);

			const dirs = fileData.filter((file) => file.type === 'directory');
			const hasUngrouped = fileData.some((file) => file.type === 'file' && DOCUMENT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)) && getFolderName(file) === 'Ungrouped');

			setGroups(
				hasUngrouped
					? [
							...dirs,
							{
								name: 'Ungrouped',
								path: '',
								type: 'directory',
							},
						]
					: dirs
			);

			setFiles(fileData.filter((file) => file.type === 'file' && DOCUMENT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))));
		} finally {
			setLoading(false);
		}
	};

	const download = (file: FileEntry) => {
		const a = document.createElement('a');

		a.href = `/api/files/download?path=${encodeURIComponent(file.path)}`;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	const uploadWithMetadata = async (file: File, group: string | undefined, name: string, comment: string, collaborators: string[]) => {
		const targetDir = group && group !== 'Ungrouped' ? `documents/${group}` : 'documents';
		await uploadFile(file, client, targetDir as any, {
			name,
			comment,
			collaborators,
		});
	};

	const saveFileMetadata = async (file: FileEntry, name: string, comment: string, collaborators: string[]) => {
		const extension = file.name.split('.').pop() ?? '';

		const filename = file.name.replace(new RegExp(`\\.${extension}$`), '');

		const parts = filename.split('__');

		const date = parts[1] ?? '';
		const uploader = parts[2] ?? '';

		const newFilename = [name.replaceAll(' ', '_'), date, uploader, collaborators.join('-'), comment].join('__') + '.' + extension;

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

	const createGroup = async () => {
		if (!newGroupName.trim()) {
			return;
		}

		const documentsPath = `${basePath}/${client}/documents`;

		await fetch('/api/files', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				dir: documentsPath,
				name: newGroupName.trim(),
			}),
		});

		setNewGroupOpen(false);
		setNewGroupName('');

		await load();
	};

	const renameGroup = async () => {
		if (!groupToRename || !newGroupName.trim()) {
			return;
		}

		await fetch('/api/files', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				oldPath: groupToRename.path,
				newName: newGroupName.trim(),
			}),
		});

		setRenameGroupOpen(false);
		setGroupToRename(null);
		setNewGroupName('');

		await load();
	};

	const moveFileToGroup = async (file: FileEntry | null, group: string) => {
		if (!file) return;
		if (getFolderName(file) === group) {
			setDraggingFile(null);
			return;
		}

		const { baseName, extension } = parseDocumentMetadata(file.name);
		const groupKey = extension ? `${baseName}.${extension}` : baseName;

		const currentFolder = getFolderName(file);
		const relatedFiles = files.filter((f) => {
			if (getFolderName(f) !== currentFolder) return false;
			const meta = parseDocumentMetadata(f.name);
			const k = meta.extension ? `${meta.baseName}.${meta.extension}` : meta.baseName;
			return k === groupKey;
		});

		const targetDir = group === 'Ungrouped' ? `${basePath}/${client}/documents` : `${basePath}/${client}/documents/${group}`;

		await Promise.all(
			relatedFiles.map((f) =>
				fetch('/api/files', {
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						oldPath: f.path,
						newDir: targetDir,
					}),
				})
			)
		);

		setDraggingFile(null);
		await load();
	};

	const downloadGroup = (group: FileEntry) => {
		const a = document.createElement('a');

		a.href = `/api/files/download?path=${encodeURIComponent(group.path)}`;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	const deleteDocumentGroup = async () => {
		if (!deleteGroup) {
			return;
		}

		try {
			setDeletingGroup(true);

			await fetch('/api/files', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					path: deleteGroup.path,
					recursive: true,
				}),
			});

			setDeleteGroup(null);

			await load();
		} finally {
			setDeletingGroup(false);
		}
	};

	useEffect(() => {
		if (!session?.user?.preferences?.defaultView) return;

		setView(session.user.preferences.defaultView);
	}, [session]);

	useEffect(() => {
		load();
	}, [basePath, client]);

	if (loading) return <Loading title="Loading documents" />;

	return (
		<section
			className="space-y-6 relative"
			onDragEnter={(e) => {
				if (!canWrite) return;
				if (!e.dataTransfer.types.includes('Files')) return;
				e.preventDefault();
				dragCounter.current++;
				setDragging(true);
			}}
			onDragLeave={() => {
				if (!canWrite) return;
				dragCounter.current--;
				if (dragCounter.current <= 0) {
					setDragging(false);
				}
			}}
			onDragOver={(e) => {
				if (!canWrite) return;
				e.preventDefault();
			}}
			onDrop={(e) => {
				if (!canWrite) return;
				e.preventDefault();
				dragCounter.current = 0;
				setDragging(false);

				const dropped = Array.from(e.dataTransfer.files).filter((file) => DOCUMENT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)));
				if (dropped.length === 0) return;

				setSelectedFiles(dropped);
				setInitialGroup('Ungrouped');
				setUploadModalOpen(true);
			}}
		>
			<DebugInfo>
				<div>Ext filter: {DOCUMENT_EXTENSIONS.join(', ')}</div>
				<div>Total raw files: {files.length}</div>
				<div>Total groups: {groups.length}</div>
			</DebugInfo>

			<input
				ref={inputRef}
				type="file"
				multiple
				accept={DOCUMENT_EXTENSIONS.join(',')}
				className="hidden"
				onChange={(e) => {
					const files = Array.from(e.target.files ?? []);

					if (!files.length) return;

					setSelectedFiles(files);
					setInitialGroup('Ungrouped');
					setUploadModalOpen(true);

					e.target.value = '';
				}}
			/>

			<div className="rounded-3xl p-6 space-y-6 bg-(--foreground)">
				<div className="flex items-center justify-end gap-2">
					<ViewToggle value={view ?? 'list'} onChange={setView} />

					{canWrite && (
						<>
							<Button
								onClick={() => {
									setNewGroupName('');
									setNewGroupOpen(true);
								}}
							>
								New Group
							</Button>

							<Button icon={<Upload size={16} />} onClick={() => inputRef.current?.click()} disabled={uploading}>
								{uploading ? 'Uploading...' : 'Upload'}
							</Button>
						</>
					)}
				</div>

				{groups.length === 0 && files.length === 0 && (
					<motion.div key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<EmptyState title="No Documents Found" description="Upload PDF, Word, Excel or text documents to get started." />
					</motion.div>
				)}

				{groups.map((group) => {
					const folderName = group.name;
					const folderFiles = files.filter((file) => getFolderName(file) === folderName);

					const grouped = folderFiles.reduce(
						(acc, file) => {
							const { baseName, extension } = parseDocumentMetadata(file.name);
							const groupKey = extension ? `${baseName}.${extension}` : baseName;

							if (!acc[groupKey]) {
								acc[groupKey] = [];
							}
							acc[groupKey].push(file);
							return acc;
						},
						{} as Record<string, FileEntry[]>
					);

					Object.keys(grouped).forEach((key) => {
						grouped[key].sort((a, b) => {
							const aMeta = parseDocumentMetadata(a.name);
							const bMeta = parseDocumentMetadata(b.name);
							const dateDiff = bMeta.date - aMeta.date;
							if (dateDiff !== 0) return dateDiff;
							return bMeta.revision - aMeta.revision;
						});
					});

					return (
						<div
							key={folderName}
							className="space-y-4"
							onDragOver={(e) => e.preventDefault()}
							onDrop={async (e) => {
								e.preventDefault();
								e.stopPropagation();

								const droppedOSFiles = Array.from(e.dataTransfer?.files || []).filter((file) => DOCUMENT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)));
								if (droppedOSFiles.length > 0) {
									dragCounter.current = 0;
									setDragging(false);
									setSelectedFiles(droppedOSFiles);
									setInitialGroup(folderName);
									setUploadModalOpen(true);
									return;
								}

								await moveFileToGroup(draggingFile, folderName);
							}}
						>
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-lg">{folderName}</h3>

								<div className="text-sm text-(--text-muted) flex items-center gap-2">
									<div>
										{folderFiles.length} document{folderFiles.length !== 1 ? 's' : ''}
									</div>

									{folderName !== 'Ungrouped' && canWrite && (
										<>
											<Button
												variant="ghost"
												onClick={() => {
													setGroupToRename(group);
													setNewGroupName(group.name);
													setRenameGroupOpen(true);
												}}
											>
												<Pencil size={15} />
											</Button>

											<Button variant="ghost" onClick={() => downloadGroup(group)}>
												<Download size={15} />
											</Button>

											<Button variant="danger-ghost" onClick={() => setDeleteGroup(group)}>
												<Trash2 size={15} />
											</Button>
										</>
									)}
								</div>
							</div>

							{folderFiles.length === 0 && (
								<div className="rounded-3xl p-6 min-h-20 flex items-center justify-center border-2 border-dashed border-(--accent)/30 bg-(--background)">
									<div className="text-center">
										<div className="text-sm font-medium text-(--text-muted)">No documents</div>
										<div className="text-xs text-(--text-muted) mt-1 opacity-70">Drag documents here or upload new ones</div>
									</div>
								</div>
							)}

							<div className="space-y-6">
								{Object.entries(grouped).map(([groupKey, entries], i) => {
									if (!entries.length) return null;

									const latest = entries[0];
									const older = entries.slice(1);
									const uniqueGroupKey = `${folderName}-${groupKey}`;
									const isExpanded = expandedGroups.includes(uniqueGroupKey);

									return (
										<div key={uniqueGroupKey + i} className="space-y-3">
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
															onDragStart={setDraggingFile}
														/>

														{older.length > 0 && (
															<div
																onClick={() =>
																	setExpandedGroups((prev) => (prev.includes(uniqueGroupKey) ? prev.filter((g) => g !== uniqueGroupKey) : [...prev, uniqueGroupKey]))
																}
																className="rounded-3xl min-h-45 flex items-center justify-center cursor-pointer bg-(--accent)/10 border-2 border-(--accent)/70 transition hover:opacity-80"
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
																	onDragStart={setDraggingFile}
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
														onDragStart={setDraggingFile}
														permission="projects.write"
													/>

													{older.length > 0 && (
														<Button
															className="w-full"
															variant="primary-ghost"
															onClick={() =>
																setExpandedGroups((prev) => (prev.includes(uniqueGroupKey) ? prev.filter((g) => g !== uniqueGroupKey) : [...prev, uniqueGroupKey]))
															}
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
																	onDragStart={setDraggingFile}
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
							</div>
						</div>
					);
				})}
			</div>

			<Modal
				open={newGroupOpen}
				title="New Document Group"
				onClose={() => {
					setNewGroupOpen(false);
					setNewGroupName('');
				}}
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => {
								setNewGroupOpen(false);
								setNewGroupName('');
							}}
						>
							Cancel
						</Button>

						<Button onClick={createGroup}>Create</Button>
					</>
				}
			>
				<Input label={'Group Name'} value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Invoices" />
			</Modal>

			<Modal
				open={renameGroupOpen}
				title="Rename Group"
				onClose={() => {
					setRenameGroupOpen(false);
					setGroupToRename(null);
				}}
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => {
								setRenameGroupOpen(false);
								setGroupToRename(null);
							}}
						>
							Cancel
						</Button>

						<Button onClick={renameGroup}>Save</Button>
					</>
				}
			>
				<Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
			</Modal>

			<ConfirmDialog
				open={!!deleteGroup}
				title="Delete document group"
				description={`Delete "${deleteGroup?.name}" and all documents inside it? This cannot be undone.`}
				confirmText="Delete Group"
				loading={deletingGroup}
				onClose={() => {
					if (!deletingGroup) {
						setDeleteGroup(null);
					}
				}}
				onConfirm={deleteDocumentGroup}
			/>

			<FileUploadModal
				open={uploadModalOpen}
				files={selectedFiles}
				groups={groups.map((g) => g.name)}
				initialGroup={initialGroup}
				users={users}
				onUpload={uploadWithMetadata}
				onClose={async () => {
					setUploadModalOpen(false);
					setSelectedFiles([]);

					await load();
				}}
			/>

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
				<div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 pointer-events-none">
					<div className="p-12 text-center bg-(--foreground) rounded-2xl shadow-xl border border-(--border)/10">
						<div className="space-y-3">
							<Upload size={48} className="mx-auto text-(--accent)" />
							<h2 className="text-xl font-semibold">Drop documents to upload</h2>
							<p className="text-sm text-(--text-muted)">Release your documents anywhere to upload them, or drop on a group to upload directly.</p>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
