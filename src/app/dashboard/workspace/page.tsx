/** @format */
'use client';

import { ArrowUp, Copy, Download, File, Folder, Home, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { motion } from 'framer-motion';

type FileEntry = {
	path: string;
	name: string;
	type: string;
	size?: number | null;
	modified?: string;
};

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

function isImage(name: string) {
	const lower = name.toLowerCase();
	return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export default function Page() {
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [files, setFiles] = useState<FileEntry[]>([]);
	const [query, setQuery] = useState('');
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState<'list' | 'grid'>('list');

	const uploadRef = useRef<HTMLInputElement>(null);

	const isSearching = query.trim().length > 0;

	/* ---------------- LOAD USER ROOT ---------------- */

	async function loadWorkspace() {
		const res = await fetch('/api/workspace/user');
		const data = await res.json();

		if (data.path) {
			setCurrentPath(data.path);
			await loadFiles(data.path);
		}

		setLoading(false);
	}

	/* ---------------- FILES ---------------- */

	async function loadFiles(path: string, recursive = false) {
		const res = await fetch(`/api/files?view=${encodeURIComponent(path)}${recursive ? '&recursive=1' : ''}`);
		const data = await res.json();

		setFiles(Array.isArray(data) ? data : []);
	}

	const hasImages = files.some((f) => isImage(f.name));

	useEffect(() => {
		loadWorkspace();
	}, []);

	useEffect(() => {
		if (!currentPath) return;

		if (isSearching) {
			const t = setTimeout(() => loadFiles(currentPath, true), 400);
			return () => clearTimeout(t);
		}

		loadFiles(currentPath, false);
	}, [currentPath, query]);

	const filtered = useMemo(() => {
		const list = !query ? files : files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

		return [...list].sort((a, b) => {
			if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
	}, [files, query]);

	/* ---------------- ACTIONS ---------------- */

	function navigate(file: FileEntry) {
		if (file.type === 'directory') {
			setQuery('');
			setCurrentPath(file.path);
		}
	}

	function goUp() {
		if (!currentPath) return;
		const parent = currentPath.substring(0, currentPath.lastIndexOf('\\'));
		setCurrentPath(parent);
	}

	function goHome() {
		loadWorkspace();
	}

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
	}

	function download(path: string) {
		window.location.href = `/api/files/download?path=${encodeURIComponent(path)}`;
	}

	async function remove(path: string) {
		await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
			method: 'DELETE',
		});
		loadFiles(currentPath!);
	}

	async function rename(oldPath: string) {
		const name = prompt('New name?');
		if (!name) return;

		await fetch('/api/files', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ oldPath, newName: name }),
		});

		loadFiles(currentPath!);
	}

	async function upload(e: React.ChangeEvent<HTMLInputElement>) {
		if (!e.target.files || !currentPath) return;

		for (const file of Array.from(e.target.files)) {
			const fd = new FormData();
			fd.append('file', file);
			fd.append('dir', currentPath);

			await fetch('/api/files', {
				method: 'POST',
				body: fd,
			});
		}

		loadFiles(currentPath);
	}

	/* ---------------- UI ---------------- */

	if (loading) return <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">My Workspace</h1>
				<p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage your personal files and folders.</p>
			</div>

			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3">
				{[
					{ icon: Home, onClick: goHome },
					{ icon: ArrowUp, onClick: goUp },
					{
						icon: Copy,
						onClick: () => currentPath && copy(currentPath),
					},
				].map(({ icon: Icon, onClick }, i) => (
					<button
						key={i}
						onClick={onClick}
						disabled={isSearching}
						className="h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
					>
						<Icon size={16} />
					</button>
				))}

				<div className="relative max-w-xs">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
					<input
						placeholder="Search files…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="h-9 pl-9 pr-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-(--accent)/30 transition"
					/>
					{query && (
						<button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
							✕
						</button>
					)}
				</div>

				{hasImages && (
					<button
						onClick={() => setView((v) => (v === 'list' ? 'grid' : 'list'))}
						className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
					>
						{view === 'list' ? 'Gallery' : 'List'}
					</button>
				)}

				<button
					onClick={() => uploadRef.current?.click()}
					className="h-9 px-4 flex items-center gap-2 rounded-lg bg-(--accent) text-white text-sm font-medium hover:bg-(--hover-accent) transition"
				>
					<Upload size={16} />
					Upload
				</button>

				<input type="file" ref={uploadRef} multiple className="hidden" onChange={upload} />
			</div>

			{/* List */}
			{view === 'list' ? (
				/* ===== LIST VIEW (your existing UI) ===== */
				<motion.div
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden"
				>
					{filtered.length === 0 && <div className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400">No files found.</div>}

					{filtered.map((f) => (
						<div
							key={f.path}
							className="flex items-center justify-between px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 first:border-t-0 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
						>
							<div onClick={() => navigate(f)} className="flex items-center gap-3 cursor-pointer min-w-0">
								{f.type === 'directory' ? <Folder size={18} className="text-(--accent)" /> : <File size={18} className="text-zinc-400" />}

								<span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{f.name}</span>
							</div>

							<div className="flex items-center gap-1">
								<Action icon={Download} onClick={() => download(f.path)} />
								<Action icon={Pencil} onClick={() => rename(f.path)} />
								<Action icon={Trash2} onClick={() => remove(f.path)} danger />
							</div>
						</div>
					))}
				</motion.div>
			) : (
				/* ===== GRID / GALLERY VIEW ===== */
				<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
					{filtered.map((f) => {
						const image = isImage(f.name);

						return (
							<div
								key={f.path}
								className="group relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 cursor-pointer"
								onClick={() => navigate(f)}
							>
								{/* IMAGE OR ICON */}
								{image ? (
									<img src={`/api/files/download?path=${encodeURIComponent(f.path)}`} className="w-full h-40 object-cover" />
								) : (
									<div className="h-40 flex items-center justify-center">
										{f.type === 'directory' ? <Folder size={28} className="text-(--accent)" /> : <File size={28} className="text-zinc-400" />}
									</div>
								)}

								{/* NAME */}
								<div className="px-3 py-2 text-xs truncate text-zinc-700 dark:text-zinc-300">{f.name}</div>

								{/* ACTIONS */}
								<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
									<Action icon={Download} onClick={() => download(f.path)} />
									<Action icon={Trash2} onClick={() => remove(f.path)} danger />
								</div>
							</div>
						);
					})}
				</motion.div>
			)}
		</div>
	);
}

/* ---------------- ACTION BUTTON ---------------- */

function Action({ icon: Icon, onClick, danger }: { icon: any; onClick: () => void; danger?: boolean }) {
	return (
		<button
			onClick={onClick}
			className={`h-8 w-8 flex items-center justify-center rounded-lg transition ${
				danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
			}`}
		>
			<Icon size={14} />
		</button>
	);
}
