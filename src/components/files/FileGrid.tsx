/** @format */
"use client";

import ProjectFile, { FileEntry } from "./File";

import { User } from "next-auth";
import { motion } from "framer-motion";

type Props = {
  files: FileEntry[];
  users?: User[];

  permission?: string;

  mode?: "project" | "explorer";

  onDownload?: (file: FileEntry) => void;
  onEdit?: (file: FileEntry) => void;
  onOpen?: (file: FileEntry) => void;
  onDelete?: (file: FileEntry) => void;
  onRename?: (file: FileEntry) => void;
  onDragStart?: (file: FileEntry) => void;
};

export default function FileGrid({
  files,
  users = [],
  permission,
  mode,
  onDownload,
  onEdit,
  onDragStart,
  onOpen,
  onDelete,
  onRename,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
      {files.map((file, index) => (
        <motion.div
          key={file.path + index}
          initial={{
            opacity: 0,
            y: 8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: index * 0.02,
          }}
        >
          <ProjectFile
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
          />
        </motion.div>
      ))}
    </div>
  );
}
