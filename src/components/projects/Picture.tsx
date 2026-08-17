/** @format */
'use client';

import { Download, Pencil, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import FileEditModal from '../files/FileEditModal';
import { FileEntry } from '../files/File';
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

const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.webm', '.avi', '.mkv'];

function getFolderName(file: FileEntry) {
	const parts = file.path.split(/[\\/]/);

	const folder = parts[parts.length - 2];

	if (folder === 'picture') {
		return 'Ungrouped';
	}

	return folder;
}

export default function Pictures({ basePath, client }: { basePath: string; client: string }) {
	const inputRef = useRef<HTMLInputElement>(null);

	const { data: session } = useSession();

	const { uploading, uploadFile } = useUpload();
	const { has } = usePermissions();

	const [draggingFile, setDraggingFile] = useState<FileEntry | null>(null);
	const [files, setFiles] = useState<FileEntry[]>([]);
	const [groups, setGroups] = useState<FileEntry[]>([]);
	const [users, setUsers] = useState<User[]>([]);

	const [loading, setLoading] = useState(true);
	const [view, setView] = useState<'grid' | 'list'>('grid');

	const dragCounter = useRef(0);
	const [dragging, setDragging] = useState(false);

	const [uploadModalOpen, setUploadModalOpen] = useState(false);
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [initialGroup, setInitialGroup] = useState<string>('Ungrouped');

	const [editModalOpen, setEditModalOpen] = useState(false);
	const [editingFile, setEditingFile] = useState<FileEntry | null>(null);

	const [newGroupOpen, setNewGroupOpen] = useState(false);
	const [newGroupName, setNewGroupName] = useState('');
	const [renameGroupOpen, setRenameGroupOpen] = useState(false);
	const [groupToRename, setGroupToRename] = useState<FileEntry | null>(null);
	const [deleteGroup, setDeleteGroup] = useState<FileEntry | null>(null);
	const [deletingGroup, setDeletingGroup] = useState(false);

	const isAllowed = has('projects.write');

	const load = async () => {
		try {
			setLoading(true);

			const picturesPath = `${basePath}/${client}/picture`;

			const [filesRes, usersRes] = await Promise.all([fetch(`/api/files?view=${encodeURIComponent(picturesPath)}&recursive=1`), fetch('/api/users')]);

			const fileData: FileEntry[] = await filesRes.json();

			const userData = await usersRes.json();

			setUsers(userData.users ?? []);

			setGroups(fileData.filter((file) => file.type === 'directory'));

			const dirs = fileData.filter((file) => file.type === 'directory');

			const hasUngrouped = fileData.some((file) => file.type === 'file' && MEDIA_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)) && getFolderName(file) === 'Ungrouped');

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

			setFiles(fileData.filter((file) => file.type === 'file' && MEDIA_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))));
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
		const targetDir = group && group !== 'Ungrouped' ? `picture/${group}` : 'picture';
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

		const picturesPath = `${basePath}/${client}/picture`;

		await fetch('/api/files', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				dir: picturesPath,
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

		const targetDir = group === 'Ungrouped' ? `${basePath}/${client}/picture` : `${basePath}/${client}/picture/${group}`;

		await fetch('/api/files', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				oldPath: file.path,
				newDir: targetDir,
			}),
		});

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

	const deletePictureGroup = async () => {
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
		if (!session?.user?.preferences?.defaultView) {
			return;
		}

		setView(session.user.preferences.defaultView);
	}, [session]);

	useEffect(() => {
		load();
	}, [basePath, client]);

	if (loading) return <Loading title="Loading media" />;

	return (
		<section
			className="space-y-6 relative"
			onDragEnter={(e) => {
				if (!isAllowed) return;
				if (!e.dataTransfer.types.includes('Files')) return;
				e.preventDefault();
				dragCounter.current++;
				setDragging(true);
			}}
			onDragLeave={() => {
				if (!isAllowed) return;
				dragCounter.current--;
				if (dragCounter.current <= 0) {
					setDragging(false);
				}
			}}
			onDragOver={(e) => {
				if (!isAllowed) return;
				e.preventDefault();
			}}
			onDrop={(e) => {
				if (!isAllowed) return;
				e.preventDefault();
				dragCounter.current = 0;
				setDragging(false);

				const dropped = Array.from(e.dataTransfer.files).filter((file) => MEDIA_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)));
				if (dropped.length === 0) return;

				setSelectedFiles(dropped);
				setInitialGroup('Ungrouped');
				setUploadModalOpen(true);
			}}
		>
			<DebugInfo>
				<div>Total media files: {files.length}</div>
				<div>Total groups: {groups.length}</div>
			</DebugInfo>

			<input
				ref={inputRef}
				type="file"
				multiple
				accept="image/*,video/*"
				className="hidden"
				onChange={(e) => {
					const files = Array.from(e.target.files ?? []);

					if (!files.length) {
						return;
					}

					setSelectedFiles(files);
					setInitialGroup('Ungrouped');
					setUploadModalOpen(true);

					e.target.value = '';
				}}
			/>

			<div className="rounded-3xl bg-(--foreground) p-6 space-y-6">
				<div className="flex items-center justify-end gap-2">
					<ViewToggle value={view} onChange={setView} />

					{isAllowed && (
						<>
							<Button
								onClick={() => {
									setNewGroupName('');
									setNewGroupOpen(true);
								}}
							>
								New Group
							</Button>

							<Button onClick={() => inputRef.current?.click()} disabled={uploading}>
								<Upload size={16} />

								{uploading ? 'Uploading...' : 'Upload'}
							</Button>
						</>
					)}
				</div>

				{groups.length === 0 && files.length === 0 && <EmptyState title="No Media Found" description="Upload media or create a media group to get started." />}

				{groups.map((group) => {
					const folder = group.name;

					const folderFiles = files.filter((file) => getFolderName(file) === folder);

					return (
						<div
							key={folder}
							className="space-y-4"
							onDragOver={(e) => e.preventDefault()}
							onDrop={async (e) => {
								e.preventDefault();
								e.stopPropagation(); // prevent root drop from firing

								// If they drop an OS file directly on the group
								const droppedOSFiles = Array.from(e.dataTransfer?.files || []).filter((file) => MEDIA_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)));
								if (droppedOSFiles.length > 0) {
									dragCounter.current = 0;
									setDragging(false);
									setSelectedFiles(droppedOSFiles);
									setInitialGroup(folder);
									setUploadModalOpen(true);
									return;
								}

								await moveFileToGroup(draggingFile, folder);
							}}
						>
							<div className="flex items-center justify-between">
								<h3 className="font-semibold">{folder}</h3>

								<div className="text-sm text-(--text-muted) flex items-center gap-2">
									<div>
										{folderFiles.length} image
										{folderFiles.length !== 1 ? 's' : ''}
									</div>

									{group.name !== 'Ungrouped' && isAllowed && (
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
										<div className="text-sm font-medium text-(--text-muted)">No images</div>

										<div className="text-xs text-(--text-muted) mt-1 opacity-70">Drag images here or upload new ones</div>
									</div>
								</div>
							)}

							{view === 'grid' ? (
								<FileGrid
									files={folderFiles}
									users={users}
									onDownload={download}
									onEdit={(file) => {
										setEditingFile(file);
										setEditModalOpen(true);
									}}
									onDragStart={setDraggingFile}
									permission="projects.write"
								/>
							) : (
								<FileList
									files={folderFiles}
									users={users}
									onDownload={download}
									onEdit={(file) => {
										setEditingFile(file);
										setEditModalOpen(true);
									}}
									onDragStart={setDraggingFile}
									permission="projects.write"
								/>
							)}
						</div>
					);
				})}
			</div>

			<Modal
				open={newGroupOpen}
				title="New Media Group"
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
				<Input label={'Group Name'} value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Kitchen" />
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
				title="Delete media group"
				description={`Delete "${deleteGroup?.name}" and all media inside it? This cannot be undone.`}
				confirmText="Delete Group"
				loading={deletingGroup}
				onClose={() => {
					if (!deletingGroup) {
						setDeleteGroup(null);
					}
				}}
				onConfirm={deletePictureGroup}
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
							<h2 className="text-xl font-semibold">Drop media to upload</h2>
							<p className="text-sm text-(--text-muted)">Release your media anywhere to upload them, or drop on a group to upload directly.</p>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
