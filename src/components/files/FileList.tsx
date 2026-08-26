/** @format */
'use client';

import ProjectFile, { FileEntry } from '../files/File';

import { User } from 'next-auth';
import { motion } from 'framer-motion';

type Props = {
	files: FileEntry[];
	users?: User[];

	permission?: string;

	mode?: 'project' | 'explorer';

	onDownload?: (file: FileEntry) => void;
	onEdit?: (file: FileEntry) => void;
	onOpen?: (file: FileEntry) => void;
	onDelete?: (file: FileEntry) => void;
	onRename?: (file: FileEntry) => void;
	onDragStart?: (file: FileEntry) => void;

	onToggleVersions?: (file: FileEntry) => void;
	versionsCount?: number;
	isVersionsExpanded?: boolean;
};

export default function FileList({ files, users = [], permission, mode, onDownload, onEdit, onDragStart, onOpen, onDelete, onRename, onToggleVersions, versionsCount, isVersionsExpanded }: Props) {
	return (
		<div className="space-y-2">
			{files.map((file, index) => (
				<motion.div
					key={file.path + index}
					initial={{
						opacity: 0,
						x: -8,
					}}
					animate={{
						opacity: 1,
						x: 0,
					}}
					transition={{
						delay: index * 0.01,
					}}
				>
					<ProjectFile
						compact
						file={file}
						users={users}
						permission={permission}
						mode={mode}
						onDownload={() => onDownload?.(file)}
						onEdit={() => onEdit?.(file)}
						onDragStart={onDragStart}
						onOpen={() => onOpen?.(file)}
						onDelete={() => onDelete?.(file)}
						onRename={() => onRename?.(file)}
						onToggleVersions={onToggleVersions}
						versionsCount={versionsCount}
						isVersionsExpanded={isVersionsExpanded}
					/>
				</motion.div>
			))}
		</div>
	);
}
