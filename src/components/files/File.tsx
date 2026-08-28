/** @format */
'use client';

import { Calendar, Download, Eye, FileText, FileType, Loader2, Pencil, UserIcon, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { useApiUrl } from '@/providers/LocalProvider';

import Button from '@/components/ui/Button';
import FileIcon from './FileIcon';
import FileViewer from './FileViewer';
import { User } from 'next-auth'; // adjust import
import { formatFileSize } from '@/lib/size';
import { usePermissions } from '@/providers/PermissionsProvider';
import { useState } from 'react';

export type FileEntry = {
	name: string;
	path: string;
	type?: string;
	thumbnail?: string;
	size?: number;
};

type FileActionHandlers = {
	onOpen?: (file: FileEntry) => void;
	onDownload?: (file: FileEntry) => void;
	onEdit?: (file: FileEntry) => void;
	onRename?: (file: FileEntry) => void;
	onDelete?: (file: FileEntry) => void;

	onSelect?: (file: FileEntry, event: React.MouseEvent) => void;
	onContextMenu?: (file: FileEntry, event: React.MouseEvent) => void;

	onDragStart?: (file: FileEntry) => void;

	onToggleVersions?: (file: FileEntry) => void;
	versionsCount?: number;
	isVersionsExpanded?: boolean;
};

type Props = FileActionHandlers & {
	file: FileEntry;

	mode?: 'project' | 'explorer';

	selected?: boolean;

	permission?: string;
	users?: User[];
	compact?: boolean;
	image?: boolean;
};

function getInitials(name?: string) {
	if (!name) return '';

	return name
		.split(/\s+/)
		.map((x) => x[0])
		.join('')
		.toUpperCase();
}

export default function File({
	file,
	users = [],
	mode = 'project',

	onOpen,
	onDownload,
	onEdit,
	onDelete,
	onRename,

	onDragStart,

	onToggleVersions,
	versionsCount,
	isVersionsExpanded,

	compact = false,
	image = false,
	permission,
}: Props) {
	const { has } = usePermissions();

	const [download, setDownload] = useState(false);
	const [viewing, setViewing] = useState(false);

	const extension = file.type === 'directory' ? '' : (file.name.split('.').pop() ?? '');
	const renderUrl = useApiUrl('/api/files/render?path=' + encodeURIComponent(file.path));
	const downloadUrl = useApiUrl('/api/files/download?path=' + encodeURIComponent(file.path));

	const filename = file.name.replace(new RegExp(`\\.${extension}$`), '');

	const parts = filename.split('__');

	const rawName = parts[0] ?? '';
	const rawDate = parts[1] ?? '';
	const rawUploader = parts[2] ?? '';
	const rawCollaborators = parts[3] ?? '';
	const rawComment = parts.slice(4).join('__');

	const revisionMatch = rawUploader.match(/^(.*)_(\d+)$/);

	const uploaderInitials = revisionMatch ? revisionMatch[1] : rawUploader;

	const revision = revisionMatch ? Number(revisionMatch[2]) : 0;

	const uploader = users.find((u) => getInitials(u.name as string) === uploaderInitials)?.name ?? uploaderInitials;

	const formattedName = rawName.replaceAll('_', ' ');

	const formattedComment = rawComment.replaceAll('__', ' ');

	const formattedDate = rawDate.length === 8 ? [rawDate.slice(0, 4), rawDate.slice(4, 6), rawDate.slice(6, 8)].reverse().join('/') : rawDate;

	const collaborators = rawCollaborators
		.split('-')
		?.filter(Boolean)
		.map((initials) => {
			return users.find((u) => getInitials(u.name as string) === initials)?.name ?? initials;
		});

	const isAllowed = (permission && has(permission as any)) ?? false;
	const isImage = image || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension);
	const isVideo = ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension);
	const isMedia = isImage || isVideo;

	const canEdit = !!onEdit;
	const canDownload = !!onDownload;
	const canOpen = !!onOpen;

	const openRender = (path: string) => {
		window.open(`/api/files/render?path=${encodeURIComponent(path)}`, '_blank');
	};

	function handleDownload() {
		onDownload?.(file);

		setDownload(true);

		setTimeout(() => {
			setDownload(false);
		}, 5000);
	}

	function handleOpen() {
		onOpen?.(file);
	}

	function handleContextMenu(event: React.MouseEvent) {
		if (!mode) return;

		event.preventDefault();
	}

	if (isMedia && !compact)
		return (
			<>
				<div
					className="rounded-3xl overflow-hidden bg-(--foreground)"
					draggable={isAllowed || false}
					onDragStart={() => onDragStart?.(file)}
					onDoubleClick={handleOpen}
					onContextMenu={handleContextMenu}
				>
					<button
						type="button"
						onClick={() => setViewing(true)}
						className="group aspect-video overflow-hidden w-full max-h-50 bg-black/5 flex items-center justify-center block cursor-zoom-in"
					>
						<div className="transition-transform duration-200 group-hover:scale-105 w-full h-full flex items-center justify-center">
							{isVideo ? (
								<video src={`/api/files/download?path=${encodeURIComponent(file.path)}`} className="w-full h-full object-cover" />
							) : (
								<FileIcon file={file} height={1080} width={1920} className="w-full h-full" />
							)}
						</div>
					</button>

					<div className="p-4">
						<div className="font-medium truncate">{formattedName}</div>

						<div className="flex gap-2 mt-3">
							{(versionsCount || 0) > 0 && onToggleVersions && (
								<Button icon={isVersionsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} onClick={() => onToggleVersions(file)}>
									{versionsCount}
								</Button>
							)}
							{canEdit && <Button icon={<Pencil size={14} />} onClick={() => onEdit?.(file)} />}

							{canDownload && <Button icon={download ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} onClick={handleDownload} disabled={download} />}
						</div>
					</div>
				</div>

				<FileViewer file={file} open={viewing} onClose={() => setViewing(false)} />
			</>
		);

	if (compact)
		return (
			<>
				<div
					className="rounded-3xl bg-(--foreground)  px-4 py-3 flex"
					draggable={isAllowed || false}
					onDragStart={() => onDragStart?.(file)}
					onDoubleClick={handleOpen}
					onContextMenu={handleContextMenu}
				>
					<div className="min-w-0 flex-1">
						<button
							className="flex gap-2 items-center"
							onClick={() => {
								if (file.type === 'file') {
									openRender(file.path);
								} else {
									handleOpen();
								}
							}}
						>
							<FileIcon file={file} size={16} />
							<div className="truncate font-medium">{formattedName}</div>
						</button>

						<div className="flex flex-wrap gap-3 mt-1 text-xs text-(--text-muted)">
							<span>{formattedDate}</span>

							{uploader && (
								<div className="flex items-center gap-2">
									<UserIcon size={14} />
									<span>{uploader || '-'}</span>
								</div>
							)}

							{revision > 0 && (
								<div className="flex items-center gap-2">
									<FileText size={14} />
									<span>{revision}</span>
								</div>
							)}

							{extension && (
								<div className="flex items-center gap-2">
									<FileType size={14} />
									<span>{extension || '-'}</span>
								</div>
							)}

							{file.size != null && (
								<div className="flex items-center gap-2">
									<Download size={14} />
									<span>{formatFileSize(file.size)}</span>
								</div>
							)}

							{!!collaborators.length && <span>{collaborators.join(', ')}</span>}
						</div>

						{!!formattedComment && <div className="text-xs text-(--text-muted) truncate mt-1">{formattedComment}</div>}
					</div>

					<div className="flex gap-2">
						{(versionsCount || 0) > 0 && onToggleVersions && (
							<Button icon={isVersionsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} onClick={() => onToggleVersions(file)}>
								{versionsCount}
							</Button>
						)}
						{isMedia && <Button icon={<Eye size={14} />} onClick={() => setViewing(true)} />}

						{canEdit && <Button icon={<Pencil size={14} />} onClick={() => onEdit?.(file)} />}

						{canDownload && <Button icon={download ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} onClick={handleDownload} disabled={download} />}
					</div>
				</div>
				<FileViewer file={file} open={viewing} onClose={() => setViewing(false)} />
			</>
		);

	return (
		<div className="rounded-3xl bg-(--foreground) p-5" draggable={isAllowed || false} onDragStart={() => onDragStart?.(file)} onDoubleClick={handleOpen} onContextMenu={handleContextMenu}>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<button
						className="flex gap-2 items-center"
						onClick={() => {
							if (file.type === 'file') {
								openRender(file.path);
							} else {
								handleOpen();
							}
						}}
					>
						<FileIcon file={file} size={16} />
						<div className="truncate font-medium">{formattedName}</div>
					</button>

					{!!formattedComment && <p className="text-sm text-(--text-muted) mt-2 wrap-break-word">{formattedComment}</p>}
				</div>

				<div className="flex gap-2">
					{(versionsCount || 0) > 0 && onToggleVersions && (
						<Button icon={isVersionsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} onClick={() => onToggleVersions(file)}>
							{versionsCount}
						</Button>
					)}
					{canEdit && <Button icon={<Pencil size={14} />} onClick={() => onEdit?.(file)} />}

					{canDownload && <Button icon={download ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} onClick={handleDownload} disabled={download} />}
				</div>
			</div>

			<div className="mt-4 grid gap-2 text-sm text-(--text-muted)">
				<div className="flex items-center gap-2">
					<Calendar size={14} />
					<span>{formattedDate || '-'}</span>
				</div>

				<div className="flex items-center gap-2">
					<UserIcon size={14} />
					<span>{uploader || '-'}</span>
				</div>

				{revision > 0 && (
					<div className="flex items-center gap-2">
						<FileText size={14} />
						<span>{revision}</span>
					</div>
				)}

				{extension && (
					<div className="flex items-center gap-2">
						<FileType size={14} />
						<span>{extension || '-'}</span>
					</div>
				)}

				{file.size != null && (
					<div className="flex items-center gap-2">
						<Download size={14} />
						<span>{formatFileSize(file.size)}</span>
					</div>
				)}

				{!!collaborators.length && (
					<div className="flex items-center gap-2">
						<Users size={14} />
						<span>{collaborators.length ? collaborators.join(', ') : '-'}</span>
					</div>
				)}
			</div>
		</div>
	);
}
