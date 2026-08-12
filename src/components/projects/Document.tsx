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
import FileUploadModal from '../files/FileUploadModal';
import Loading from '../ui/Loading';
import { User } from 'next-auth';
import ViewToggle from '../ui/ViewToggle';
import { usePermissions } from '@/providers/PermissionsProvider';
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

export default function Documents({ basePath, client }: { basePath: string; client: string }) {
	const inputRef = useRef<HTMLInputElement>(null);

	const { data: session } = useSession();

	const { uploading, uploadFile } = useUpload();
	const { has } = usePermissions();

	const [files, setFiles] = useState<FileEntry[]>([]);
	const [users, setUsers] = useState<User[]>([]);

	const [loading, setLoading] = useState(true);
	const [view, setView] = useState<'grid' | 'list'>('list');

	const dragCounter = useRef(0);
	const [dragging, setDragging] = useState(false);

	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [uploadModalOpen, setUploadModalOpen] = useState(false);

	const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
	const [editModalOpen, setEditModalOpen] = useState(false);

	const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

	const canWrite = has('projects.write');

	const grouped = files.reduce(
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

			if (dateDiff !== 0) {
				return dateDiff;
			}

			return bMeta.revision - aMeta.revision;
		});
	});

	const load = async () => {
		try {
			setLoading(true);

			const documentsPath = `${basePath}/${client}/documents`;

			const [filesRes, usersRes] = await Promise.all([fetch(`/api/files?view=${encodeURIComponent(documentsPath)}`), fetch('/api/users')]);

			const fileData: FileEntry[] = await filesRes.json();
			const userData = await usersRes.json();

			setUsers(userData.users ?? []);

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

	const uploadWithMetadata = async (file: File, name: string, comment: string, collaborators: string[]) => {
		await uploadFile(file, client, 'documents', {
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

	useEffect(() => {
		if (!session?.user?.preferences?.defaultView) return;

		setView(session.user.preferences.defaultView);
	}, [session]);

	useEffect(() => {
		load();
	}, [basePath, client]);

	if (loading) return <Loading title='Loading documents' />;

	return (
		<section
			className='space-y-6 relative'
			onDragEnter={(e) => {
				if (!canWrite) return;
				e.preventDefault();
				dragCounter.current++;
				setDragging(true);
			}}
			onDragOver={(e) => {
				if (!canWrite) return;
				e.preventDefault();
			}}>
			<input
				ref={inputRef}
				type='file'
				multiple
				accept={DOCUMENT_EXTENSIONS.join(',')}
				className='hidden'
				onChange={(e) => {
					const files = Array.from(e.target.files ?? []);

					if (!files.length) return;

					setSelectedFiles(files);
					setUploadModalOpen(true);

					e.target.value = '';
				}}
			/>

			<div className='rounded-3xl p-6 space-y-6 bg-(--foreground)'>
				<AnimatePresence mode='popLayout'>
					<div key='header' className='flex items-center justify-end gap-2'>
						<ViewToggle value={view ?? 'list'} onChange={setView} />

						{canWrite && (
							<Button icon={<Upload size={16} />} onClick={() => inputRef.current?.click()} disabled={uploading}>
								{uploading ? 'Uploading...' : 'Upload'}
							</Button>
						)}
					</div>

					{Object.entries(grouped).map(([groupKey, entries], i) => {
						if (!entries.length) return null;

						const latest = entries[0];
						const older = entries.slice(1);
						const isExpanded = expandedGroups.includes(groupKey);

						return (
							<div key={groupKey + i} className='space-y-3'>
								<div className='flex items-center gap-2'>
									<h3 className='text-sm font-semibold'>{groupKey}</h3>
								</div>

								{view === 'grid' ? (
									<>
										<div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
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
													onClick={() => setExpandedGroups((prev) => (prev.includes(groupKey) ? prev.filter((g) => g !== groupKey) : [...prev, groupKey]))}
													className='rounded-3xl min-h-45 flex items-center justify-center cursor-pointer bg-(--accent)/10 border-2 border-(--accent)/70 transition hover:opacity-80'>
													<div className='text-center'>
														{isExpanded ? <ChevronLeft className='mx-auto w-8 h-8' /> : <ChevronRight className='mx-auto w-8 h-8' />}
														<div className='text-xs mt-2 text-zinc-500'>{older.length} older</div>
													</div>
												</div>
											)}
										</div>

										<AnimatePresence>
											{isExpanded && (
												<motion.div key='expanded-grid' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
													<FileGrid
														files={older}
														users={users}
														onDownload={download}
														onEdit={(file) => {
															setEditingFile(file);
															setEditModalOpen(true);
														}}
														permission='projects.write'
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
											permission='projects.write'
										/>

										{older.length > 0 && (
											<Button
												className='w-full'
												variant='primary-ghost'
												onClick={() => setExpandedGroups((prev) => (prev.includes(groupKey) ? prev.filter((g) => g !== groupKey) : [...prev, groupKey]))}>
												{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
												<span>{isExpanded ? 'Hide older' : `Show older (${older.length})`}</span>
											</Button>
										)}

										<AnimatePresence>
											{isExpanded && (
												<motion.div key='expanded-list' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
													<FileList
														files={older}
														users={users}
														onDownload={download}
														onEdit={(file) => {
															setEditingFile(file);
															setEditModalOpen(true);
														}}
														permission='projects.write'
													/>
												</motion.div>
											)}
										</AnimatePresence>
									</>
								)}
							</div>
						);
					})}

					{!loading && Object.values(grouped).every((arr) => arr.length === 0) && (
						<motion.div key='empty-state' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
							<EmptyState title='No Documents Found' description='Upload PDF, Word, Excel or text documents to get started.' />
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<FileUploadModal
				open={uploadModalOpen}
				files={selectedFiles}
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
					onDrop={(e) => {
						e.preventDefault();
						dragCounter.current = 0;
						setDragging(false);

						const dropped = Array.from(e.dataTransfer.files).filter((file) => DOCUMENT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)));
						if (dropped.length === 0) return;

						setSelectedFiles(dropped);
						setUploadModalOpen(true);
					}}
					className='fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center'>
					<div className='p-12 text-center bg-(--foreground) rounded-2xl shadow-xl border border-(--border)/10 pointer-events-none'>
						<div className='space-y-3'>
							<Upload size={48} className='mx-auto text-(--accent)' />
							<h2 className='text-xl font-semibold'>Drop documents to upload</h2>
							<p className='text-sm text-(--text-muted)'>Release your files anywhere to upload them.</p>
						</div>
					</div>
				</motion.div>
			)}
		</section>
	);
}
