'use client';

import { Copy, RefreshCw, Check, Tag, Layers, Cpu, Clock, Radio, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/providers/ToastProvider';

const syntaxHighlight = (json: string) => {
	json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
		let cls = 'text-blue-500 dark:text-blue-400';
		if (/^"/.test(match)) {
			if (/:$/.test(match)) {
				cls = 'text-[var(--accent)]';
			} else {
				cls = 'text-emerald-600 dark:text-emerald-400';
			}
		} else if (/true|false/.test(match)) {
			cls = 'text-orange-500 dark:text-orange-400';
		} else if (/null/.test(match)) {
			cls = 'text-red-500 dark:text-red-400';
		}
		return '<span class="' + cls + '">' + match + '</span>';
	});
};

export default function Feed({ projectId, onActionsChange }: { projectId: string; onActionsChange?: (actions: any) => void }) {
	const [messages, setMessages] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [limit, setLimit] = useState(100);
	const [isLive, setIsLive] = useState(false);
	const [showBuilder, setShowBuilder] = useState(false);

	// Form state
	const [msgContent, setMsgContent] = useState('');
	const [msgStatus, setMsgStatus] = useState('');
	const [msgAction, setMsgAction] = useState('');
	const [msgName, setMsgName] = useState('');
	const [msgType, setMsgType] = useState('');
	const [msgDevice, setMsgDevice] = useState('');

	// Copy animations state
	const [expandedMessages, setExpandedMessages] = useState<Record<number, boolean>>({});
	const [copiedUrl, setCopiedUrl] = useState(false);
	const [copiedJson, setCopiedJson] = useState(false);
	const [showJson, setShowJson] = useState(false);

	const { data: session } = useSession();
	const isDebug = session?.user?.preferences?.debugMode === true;

	const toast = useToast();

	const apiUrl = `https://api.crea-accent.app/v1/messages/${projectId}`;

	const jsonPayload: any = {};
	if (msgContent) jsonPayload.message = msgContent;
	if (msgStatus) jsonPayload.status = msgStatus;
	if (msgAction) jsonPayload.action = msgAction;
	if (msgName) jsonPayload.name = msgName;
	if (msgType) jsonPayload.type = msgType;
	if (msgDevice) jsonPayload.device = msgDevice;

	const generatedJson = JSON.stringify(jsonPayload, null, 2);

	const toggleExpand = (idx: number) => setExpandedMessages((prev) => ({ ...prev, [idx]: !prev[idx] }));

	const fetchMessages = async (silent = false) => {
		if (!projectId) return;
		try {
			if (!silent) setLoading(true);
			const res = await fetch(`/api/messages/${projectId}`);
			if (res.ok) {
				const data = await res.json();
				let msgList = Array.isArray(data) ? data : data.messages || [];
				msgList = msgList.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
				setMessages(msgList);
			} else {
				if (!silent) toast('error', 'Failed to fetch messages.');
			}
		} catch (err) {
			console.error('Error fetching messages:', err);
			if (!silent) toast('error', 'Could not connect to API.');
		} finally {
			if (!silent) setLoading(false);
		}
	};

	useEffect(() => {
		fetchMessages();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectId]);

	useEffect(() => {
		onActionsChange?.({
			showBuilder,
			setShowBuilder,
			isLive,
			setIsLive,
			refresh: () => fetchMessages(false),
			loading,
		});
	}, [onActionsChange, showBuilder, isLive, loading]);

	useEffect(() => {
		let interval: any;
		let timeout: any;

		if (isLive) {
			interval = setInterval(() => {
				fetchMessages(true);
			}, 1000);

			timeout = setTimeout(() => {
				setIsLive(false);
			}, 60000);
		}

		return () => {
			clearInterval(interval);
			clearTimeout(timeout);
		};
	}, [isLive, projectId]);

	const copyToClipboard = (text: string, type: 'url' | 'json') => {
		navigator.clipboard.writeText(text);
		toast('success', `${type === 'url' ? 'URL' : 'JSON'} copied to clipboard.`);

		if (type === 'url') {
			setCopiedUrl(true);
			setTimeout(() => setCopiedUrl(false), 2000);
		} else {
			setCopiedJson(true);
			setTimeout(() => setCopiedJson(false), 2000);
		}
	};

	if (!projectId) {
		return (
			<Card className="p-6">
				<p className="text-(--text-muted)">Project ID not found. Please refresh or recreate the project.</p>
			</Card>
		);
	}

	return (
		<div className="flex flex-col lg:flex-row gap-6 lg:items-start w-full">
			{/* Left Column: API Documentation / Testing Box */}
			{showBuilder && (
				<div className="w-full lg:w-[450px] xl:w-[500px] shrink-0 lg:sticky top-6 flex flex-col gap-6">
					<Card className="p-6 bg-[var(--background)] border border-[var(--border)]/10 shadow-sm rounded-xl">
						<h3 className="text-lg font-semibold mb-4">Builder</h3>

						<div className="space-y-6">
							<div>
								<label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">Endpoint URL (POST)</label>
								<div className="flex gap-2">
									<code className="flex-1 block p-3 bg-black/5 dark:bg-white/5 rounded-lg text-sm border border-[var(--border)]/5 overflow-x-auto whitespace-nowrap">{apiUrl}</code>
									<Button variant="secondary" onClick={() => copyToClipboard(apiUrl, 'url')} icon={copiedUrl ? <Check size={16} className="text-green-500" /> : <Copy size={16} />} />
								</div>
							</div>

							<div className="grid grid-cols-1 gap-6">
								<div className="space-y-3">
									<h4 className="text-sm font-medium text-[var(--text-muted)]">Payload</h4>
									<div>
										<label className="block text-xs mb-1 text-[var(--text-muted)]">Message</label>
										<Input value={msgContent} onChange={(e) => setMsgContent(e.target.value)} placeholder="e.g. test" />
									</div>
									<div>
										<label className="block text-xs mb-1 text-[var(--text-muted)]">Status</label>
										<Input value={msgStatus} onChange={(e) => setMsgStatus(e.target.value)} placeholder="e.g. info" />
									</div>
									<div>
										<label className="block text-xs mb-1 text-[var(--text-muted)]">Action</label>
										<Input value={msgAction} onChange={(e) => setMsgAction(e.target.value)} placeholder="e.g. none" />
									</div>
									<div>
										<label className="block text-xs mb-1 text-[var(--text-muted)]">Name</label>
										<Input value={msgName} onChange={(e) => setMsgName(e.target.value)} placeholder="e.g. sensor_1" />
									</div>
									<div>
										<label className="block text-xs mb-1 text-[var(--text-muted)]">Type</label>
										<Input value={msgType} onChange={(e) => setMsgType(e.target.value)} placeholder="e.g. event" />
									</div>
									<div>
										<label className="block text-xs mb-1 text-[var(--text-muted)]">Device</label>
										<Input value={msgDevice} onChange={(e) => setMsgDevice(e.target.value)} placeholder="e.g. raspi_4" />
									</div>
								</div>

								<div className="space-y-3 flex flex-col">
									<h4 className="text-sm font-medium text-[var(--text-muted)]">Generated JSON</h4>
									<div className="flex-1 relative">
										<pre className="h-full block p-4 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-mono border border-[var(--border)]/5 overflow-x-auto">
											<code dangerouslySetInnerHTML={{ __html: syntaxHighlight(generatedJson) }} />
										</pre>
										<div className="absolute top-2 right-2">
											<Button
												variant="secondary"
												size="sm"
												onClick={() => copyToClipboard(generatedJson, 'json')}
												icon={copiedJson ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					</Card>
				</div>
			)}

			{/* Right Column: Feed Viewer */}
			<div className="flex-1 flex flex-col gap-4 min-w-0 w-full">
				<div className="flex justify-between items-center px-1">
					<h3 className="text-lg font-semibold">Message Feed</h3>
				</div>

				{messages.length === 0 ? (
					<Card className="p-12 text-center text-[var(--text-muted)] border-dashed">
						<p>{loading ? 'Loading...' : 'No messages found.'}</p>
					</Card>
				) : (
					<div className="space-y-3">
						{messages.slice(0, limit).map((msg, idx) => (
							<Card key={idx} className="p-4 shadow-sm text-sm break-words overflow-hidden bg-white dark:bg-[#1a1a1a]">
								<div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4 mb-2">
									<div className="flex items-center gap-2 flex-wrap">
										{msg.status && (
											<Badge color={msg.status === 'error' ? '#ef4444' : msg.status === 'warning' ? '#f59e0b' : msg.status === 'success' ? '#10b981' : '#3b82f6'}>
												<span className="uppercase text-[10px] tracking-wider font-bold">{msg.status}</span>
											</Badge>
										)}
										<span className="font-semibold">{msg.action || 'Webhook Event'}</span>
										{msg.name && (
											<span className="flex items-center gap-1.5 text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded-md">
												<Tag size={12} /> {msg.name}
											</span>
										)}
										{msg.type && (
											<span className="flex items-center gap-1.5 text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md">
												<Layers size={12} /> {msg.type}
											</span>
										)}
										{msg.device && (
											<span className="flex items-center gap-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md">
												<Cpu size={12} /> {msg.device}
											</span>
										)}
									</div>
									<span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] whitespace-nowrap">
										<Clock size={12} />
										{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : 'Unknown date'}
									</span>
								</div>
								{msg.message && <p className="text-[var(--text-muted)]">{msg.message}</p>}

								{isDebug && (
									<div className="mt-3">
										<Button variant="ghost" size="sm" onClick={() => toggleExpand(idx)} className="text-xs py-1 h-auto text-[var(--text-muted)] hover:text-[var(--text)]">
											{expandedMessages[idx] ? 'Hide JSON body' : 'Show JSON body'}
										</Button>
										{expandedMessages[idx] && (
											<pre className="mt-2 p-3 bg-black/5 dark:bg-white/5 rounded-lg text-xs font-mono text-[var(--text-muted)] overflow-x-auto">
												<code dangerouslySetInnerHTML={{ __html: syntaxHighlight(JSON.stringify(msg, null, 2)) }} />
											</pre>
										)}
									</div>
								)}
							</Card>
						))}
						{messages.length > limit && (
							<Button variant="secondary" className="w-full mt-2" onClick={() => setLimit(limit + 100)}>
								Load 100 more ({messages.length - limit} remaining)
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
