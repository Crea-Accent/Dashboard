/** @format */
"use client";

import {
  Code,
  Factory,
  File,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Folder,
  Network,
  Workflow,
} from "lucide-react";

import { FaFilePdf } from "react-icons/fa";
import Image from "next/image";

type Props = {
  file: { name: string; path?: string; type?: string };

  size?: number;
  height?: number | null;
  width?: number | null;
  className?: string;
};

export default function FileIcon({
  file,
  size = 20,
  height = null,
  width = null,
  className,
}: Props) {
  const ext = file.name.toLowerCase().split(".").pop();

  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
    ext ?? "",
  );

  if (isImage && file.path) {
    return (
      <Image
        src={`/api/files/download?path=${encodeURIComponent(file.path)}`}
        alt={file.name}
        className={`rounded object-cover ${className ?? ""}`}
        width={width || size}
        height={height || size}
        unoptimized
      />
    );
  }

  if (file.type === "directory") {
    return <Folder size={size} />;
  }

  switch (ext) {
    case "loxone":
      return <Network size={size} className="text-green-300" />;

    case "dnc":
      return <Workflow size={size} className="text-blue-300" />;

    case "lsc":
      return <Factory size={size} className="text-blue-900" />;

    case "pdf":
      return <FaFilePdf size={size} className="text-red-500" />;

    case "xlsx":
    case "xlsm":
    case "xls":
    case "csv":
      return <FileSpreadsheet size={size} className="text-green-500" />;

    case "json":
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "html":
    case "css":
      return <FileCode2 size={size} className="text-yellow-300" />;

    case "zip":
    case "rar":
    case "7z":
      return <FileArchive size={size} className="text-yellow-500" />;

    case "schrack":
    case "trik":
    case "txt":
      return <FileText size={size} className="text-blue-500" />;

    default:
      return <File size={size} />;
  }
}
