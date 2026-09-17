'use client';

import { useEffect, useState, useRef, ChangeEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
	ChevronLeft,
	Plus,
	Mail,
	Trash2,
	Mails,
	Users,
	MapPin,
	User,
	Download,
	CalendarRange,
	Edit2,
	Building2,
	Calendar,
	Clock,
	Play,
	Square,
	Ban,
	Eye,
	Image as ImageIcon,
	Ribbon,
	Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import groupsplit, { leaders } from '@/lib/groupsplit';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Selector from '@/components/ui/Selector';
import { useToast } from '@/providers/ToastProvider';
import EventModal from '@/components/events/EventModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function EventDetail({ params }: { params: Promise<{ id: string }> }) {
	const toast = useToast();
	const { data: session } = useSession();

	const [id, setId] = useState<string | null>(null);
	const [event, setEvent] = useState<any>(null);
	const [contacts, setContacts] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const [scheduleData, setScheduleData] = useState<any[]>([]);
	const [confirmedNames, setConfirmedNames] = useState<string[]>([]);

	const [editModalOpen, setEditModalOpen] = useState(false);
	const [previewModalOpen, setPreviewModalOpen] = useState(false);
	const [mailConfig, setMailConfig] = useState<{ title: string; description: string; greeting: string } | null>(null);
	const [mailSaving, setMailSaving] = useState(false);
	const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());
	const [confirmModalContactId, setConfirmModalContactId] = useState<string | null>(null);
	const [manualGuests, setManualGuests] = useState<{ name: string; company: string }[]>([]);
	const [manualIsVegetarian, setManualIsVegetarian] = useState(false);
	const [manualAllergies, setManualAllergies] = useState('');
	const [declineContactId, setDeclineContactId] = useState<string | null>(null);

	const bannerInputRef = useRef<HTMLInputElement>(null);
	const ribbonInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	async function handleSaveMail() {
		if (!mailConfig) return;
		try {
			setMailSaving(true);
			const res = await fetch(`/api/events/${id}/mail`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(mailConfig),
			});
			if (res.ok) {
				toast('success', 'Email content saved!');
				setPreviewTimestamp(Date.now());
			} else {
				toast('error', 'Failed to save email content');
			}
		} catch (err) {
			toast('error', 'An error occurred');
		} finally {
			setMailSaving(false);
		}
	}

	async function handleUploadBranding(e: ChangeEvent<HTMLInputElement>, type: 'banner' | 'ribbon') {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			setUploading(true);
			const formData = new FormData();
			formData.append('file', file);
			formData.append('type', type);
			formData.append('eventId', id || '');

			const res = await fetch('/api/events/branding', {
				method: 'POST',
				body: formData,
			});

			if (res.ok) {
				toast('success', `${type} updated successfully!`);
				setPreviewTimestamp(Date.now());
			} else {
				toast('error', `Failed to update ${type}`);
			}
		} catch (err) {
			toast('error', `An error occurred while uploading ${type}`);
		} finally {
			setUploading(false);
			if (e.target) e.target.value = '';
		}
	}

	const [modalOpen, setModalOpen] = useState(false);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [company, setCompany] = useState('');
	const [selectedContactId, setSelectedContactId] = useState('');
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [saving, setSaving] = useState(false);

	const [companiesList, setCompaniesList] = useState<string[]>([]);
	const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

	const companySuggestions = companiesList.filter((c) => company && c.toLowerCase().includes(company.toLowerCase()) && c !== company).slice(0, 5);

	const suggestions = contacts.filter((c) => name && c.name.toLowerCase().includes(name.toLowerCase()) && c.id !== selectedContactId).slice(0, 5);

	function handleSelect(c: any) {
		setName(c.name);
		setEmail(c.email || '');
		setCompany(c.company || '');
		setSelectedContactId(c.id);
		setShowSuggestions(false);
	}

	function handleNameChange(e: any) {
		setName(e.target.value);
		setSelectedContactId('');
		setShowSuggestions(true);
	}

	async function load() {
		try {
			const resolvedId = decodeURIComponent((await params).id);
			setId(resolvedId);

			const [eventRes, contactsRes, companiesRes] = await Promise.all([fetch(`/api/events/${resolvedId}`), fetch('/api/contacts'), fetch('/api/settings/companies')]);

			if (eventRes.ok) {
				const eData = await eventRes.json();
				setEvent(eData.event);
				setPreviewTimestamp(Date.now());
			}
			if (contactsRes.ok) {
				const cData = await contactsRes.json();
				setContacts(cData);
			}
			if (companiesRes.ok) {
				const cpData = await companiesRes.json();
				setCompaniesList(cpData.companies?.map((c: any) => c.name) || []);
			}
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		const handleMessage = (e: MessageEvent) => {
			if (e.data?.type === 'MAIL_UPDATE') {
				setMailConfig((prev) => {
					if (!prev) return prev;
					return { ...prev, [e.data.field]: e.data.value };
				});
			} else if (e.data?.type === 'IMAGE_CLICK') {
				if (e.data.field === 'banner') bannerInputRef.current?.click();
				if (e.data.field === 'ribbon') ribbonInputRef.current?.click();
			}
		};
		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	useEffect(() => {
		load();
	}, [params]);

	async function handleAddInvite() {
		try {
			setSaving(true);
			let contactId = selectedContactId;

			if (!contactId) {
				const res = await fetch('/api/contacts', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, email, company }),
				});
				if (!res.ok) throw new Error('Failed to create contact');
				const newC = await res.json();
				contactId = newC.id;
			} else {
				await fetch(`/api/contacts/${contactId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, email, company }),
				});
			}

			if (!contactId) return;

			const currentInvites = event.invites || [];
			if (currentInvites.some((inv: any) => inv.contactId === contactId)) {
				toast('error', 'This person is already on the invite list.');
				return;
			}

			const res = await fetch(`/api/events/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					updates: {
						invites: [...currentInvites, { contactId, inviteCount: 0, status: 'pending', guests: [] }],
					},
				}),
			});

			if (res.ok) {
				setModalOpen(false);
				setSelectedContactId('');
				setName('');
				setEmail('');
				setCompany('');
				load();
			}
		} catch (err) {
			alert('Error adding invite');
		} finally {
			setSaving(false);
		}
	}

	async function handleRemoveInvite(contactId: string) {
		const currentInvites = event.invites || [];
		const updated = currentInvites.filter((inv: any) => inv.contactId !== contactId);
		await fetch(`/api/events/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ updates: { invites: updated } }),
		});
		load();
	}

	async function handleMarkDeclined(contactId: string) {
		const currentInvites = event.invites || [];
		const updated = currentInvites.map((inv: any) => (inv.contactId === contactId ? { ...inv, status: 'refused' } : inv));
		await fetch(`/api/events/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ updates: { invites: updated } }),
		});
		load();
	}

	async function submitManualConfirm() {
		if (!confirmModalContactId) return;
		const currentInvites = event.invites || [];
		const updated = currentInvites.map((inv: any) =>
			inv.contactId === confirmModalContactId
				? {
						...inv,
						status: 'confirmed',
						guests: manualGuests,
						isVegetarian: manualIsVegetarian,
						allergies: manualAllergies.trim(),
					}
				: inv
		);

		await fetch(`/api/events/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ updates: { invites: updated } }),
		});
		setConfirmModalContactId(null);
		load();
	}

	async function handleSendInvite(contactId: string) {
		try {
			const res = await fetch(`/api/events/${id}/send-invite`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contactId }),
			});
			if (!res.ok) {
				const errorData = await res.json();
				toast('error', errorData.error || 'Failed to send invite');
				return false;
			}
			toast('success', 'Invite email sent successfully!');
			load();
			return true;
		} catch (err) {
			toast('error', 'An unexpected error occurred while sending the invite.');
			return false;
		}
	}

	async function handleSendAll() {
		const uninvited = invitedContacts.filter((c: any) => (c.inviteData.inviteCount || 0) === 0 && (!c.inviteData.status || c.inviteData.status === 'pending'));
		if (uninvited.length === 0) {
			toast('error', 'No uninvited pending contacts found.');
			return;
		}

		let successCount = 0;
		for (const contact of uninvited) {
			const success = await handleSendInvite(contact.id);
			if (success) successCount++;
		}

		if (successCount > 0) {
			toast('success', `Sent ${successCount} invites!`);
		}
	}

	const [sendingTest, setSendingTest] = useState(false);
	async function handleSendTest() {
		if (!session?.user?.email) {
			toast('error', 'No email found in session.');
			return;
		}
		try {
			setSendingTest(true);
			const res = await fetch(`/api/events/${id}/send-invite`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ testEmail: session.user.email }),
			});
			if (!res.ok) {
				const errorData = await res.json();
				toast('error', errorData.error || 'Failed to send test email');
			} else {
				toast('success', 'Test email sent successfully!');
			}
		} catch (err) {
			toast('error', 'An unexpected error occurred.');
		} finally {
			setSendingTest(false);
		}
	}

	function handleGenerateSchedule() {
		const names: string[] = [];
		for (const contact of invitedContacts) {
			if (contact.inviteData.status === 'confirmed') {
				names.push(contact.name);
				if (contact.inviteData.guests?.length > 0) {
					contact.inviteData.guests.forEach((g: any) => {
						if (g.name.trim()) names.push(g.name.trim());
					});
				}
			}
		}

		if (names.length < 3) {
			toast('error', 'You need at least 3 confirmed attendees to generate a schedule.');
			return;
		}

		setConfirmedNames(names);
		const result = groupsplit(names);
		setScheduleData(result);
		toast('success', 'Schedule generated successfully!');
	}

	function exportStyledExcel(data: any[], people: string[]) {
		const wb = XLSX.utils.book_new();
		const ws: XLSX.WorkSheet = {};

		const headerStyle = {
			font: { bold: true },
			alignment: { horizontal: 'center' },
		};
		const leaderStyle = { font: { bold: true } };
		const centerStyle = { alignment: { horizontal: 'center' } };

		let colOffset = 3;

		data.forEach((round, roundIndex) => {
			const startCol = colOffset + roundIndex * 4;
			ws[XLSX.utils.encode_cell({ r: 0, c: startCol })] = {
				v: `SESSIE ${round.round}`,
				s: headerStyle,
			};

			let rowCursor = 1;
			round.groups.forEach((group: any) => {
				const baseRow = rowCursor;
				const hasLeader = !!group.leader;

				if (hasLeader) {
					ws[XLSX.utils.encode_cell({ r: baseRow, c: startCol - 1 })] = {
						v: '10min',
						s: leaderStyle,
					};
					ws[XLSX.utils.encode_cell({ r: baseRow, c: startCol })] = {
						v: group.location,
						s: leaderStyle,
					};
					ws[XLSX.utils.encode_cell({ r: baseRow, c: startCol + 1 })] = {
						v: group.leader,
						s: leaderStyle,
					};
				} else {
					ws[XLSX.utils.encode_cell({ r: baseRow, c: startCol })] = {
						v: group.location,
						s: leaderStyle,
					};
				}

				group.people.forEach((p: string, i: number) => {
					const row = baseRow + (hasLeader ? 1 + i : i);
					ws[XLSX.utils.encode_cell({ r: row, c: startCol - 1 })] = {
						v: hasLeader ? '2min' : '4min',
						s: centerStyle,
					};
					ws[XLSX.utils.encode_cell({ r: row, c: startCol + 1 })] = {
						v: p,
						s: centerStyle,
					};
				});

				rowCursor += (hasLeader ? 1 + group.people.length : group.people.length) + 1;
			});
		});

		ws['A1'] = { v: 'Nr', s: headerStyle };
		ws['B1'] = { v: 'Naam', s: headerStyle };

		const finalPeople = [...leaders, ...people.filter((p) => !leaders.includes(p))];

		for (let i = 0; i < finalPeople.length; i++) {
			const name = finalPeople[i];
			const nr = i === 0 ? 'A' : i === 1 ? 'B' : i === 2 ? 'C' : i - 2;

			ws[XLSX.utils.encode_cell({ r: i + 1, c: 0 })] = { v: nr };
			ws[XLSX.utils.encode_cell({ r: i + 1, c: 1 })] = { v: name };
		}

		ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 10 }, ...Array(data.length * 4).fill({ wch: 18 })];

		ws['!ref'] = XLSX.utils.encode_range({
			s: { r: 0, c: 0 },
			e: { r: 100, c: colOffset + data.length * 4 },
		});

		XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
		XLSX.writeFile(wb, `${event.name}_Schedule.xlsx`);
	}

	if (loading) return <div>Loading...</div>;
	if (!event) return <div>Event not found</div>;

	const invitedContacts = (event.invites || [])
		.map((inv: any) => {
			const contact = contacts.find((c) => c.id === inv.contactId);
			if (!contact) return null;
			return { ...contact, inviteData: inv };
		})
		.filter(Boolean);

	const now = new Date();
	const endStr = event.endTime || '23:59';
	const endDate = new Date(`${event.date}T${endStr}:00`);
	const isPast = now > endDate;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/dashboard/events" className="p-2 bg-(--background) border border-(--border)/10 rounded-xl hover:bg-(--foreground) transition">
						<ChevronLeft size={20} />
					</Link>
					<div>
						<h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
							{event.name}
							{isPast && (
								<span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Past</span>
							)}
							{!isPast && (
								<button
									onClick={() => setEditModalOpen(true)}
									className="p-1.5 text-zinc-400 hover:text-(--accent) hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
								>
									<Edit2 size={16} />
								</button>
							)}
						</h1>
						{event.description && <p className="text-sm text-zinc-500 mt-1">{event.description}</p>}
						<div className="text-sm text-zinc-500 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
							<span className="flex items-center gap-1.5">
								<Calendar size={14} /> {event.date}
							</span>
							{event.confirmationDate && (
								<span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-500 font-medium bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md">
									<Calendar size={14} /> Bevestigen voor {event.confirmationDate}
								</span>
							)}
							{event.welcomeTime && (
								<span className="flex items-center gap-1.5">
									<Clock size={14} /> Welcome: {event.welcomeTime}
								</span>
							)}
							{event.startTime && (
								<span className="flex items-center gap-1.5">
									<Play size={14} /> Start: {event.startTime}
								</span>
							)}
							{event.endTime && (
								<span className="flex items-center gap-1.5">
									<Square size={14} /> End: {event.endTime}
								</span>
							)}
							{event.time && !event.welcomeTime && (
								<span className="flex items-center gap-1.5">
									<Clock size={14} /> {event.time}
								</span>
							)}
							{event.location && (
								<span className="flex items-center gap-1.5">
									<MapPin size={14} /> {event.location}
								</span>
							)}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<input type="file" accept="image/*" className="hidden" ref={bannerInputRef} onChange={(e) => handleUploadBranding(e, 'banner')} />
					<input type="file" accept="image/*" className="hidden" ref={ribbonInputRef} onChange={(e) => handleUploadBranding(e, 'ribbon')} />
				</div>
			</div>

			<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">Invites</h2>
						<p className="text-sm text-zinc-500">{invitedContacts.length} people invited</p>
					</div>
					<div className="flex gap-3">
						<Button
							onClick={async () => {
								setPreviewModalOpen(true);
								try {
									const res = await fetch(`/api/events/${id}/mail`);
									if (res.ok) setMailConfig(await res.json());
								} catch (e) {}
							}}
							variant="secondary"
							icon={<Eye size={16} />}
						>
							Preview Mail
						</Button>
						<Button onClick={handleSendTest} variant="secondary" icon={<Mail size={16} />} disabled={sendingTest}>
							Test Email
						</Button>
						<Button onClick={handleSendAll} variant="secondary" icon={<Mails size={16} />} disabled={isPast}>
							Send All
						</Button>
						<Button onClick={() => setModalOpen(true)} icon={<Plus size={16} />} disabled={isPast}>
							Add Invite
						</Button>
						<Button
							onClick={handleGenerateSchedule}
							variant="secondary"
							icon={<CalendarRange size={16} />}
							disabled={
								isPast || invitedContacts.filter((c: any) => c.inviteData.status === 'confirmed').reduce((acc: number, c: any) => acc + 1 + (c.inviteData.guests?.length || 0), 0) < 3
							}
						>
							Generate Schedule
						</Button>
					</div>
				</div>

				<div className="space-y-2 mt-4">
					{invitedContacts.map((contact: any) => {
						const isConfirmed = contact.inviteData.status === 'confirmed';
						const isRefused = contact.inviteData.status === 'refused';
						const isPending = !contact.inviteData.status || contact.inviteData.status === 'pending';
						const hasBeenMailed = (contact.inviteData.inviteCount || 0) > 0;

						let cardBorder = 'border-zinc-200 dark:border-zinc-800';
						let cardBg = 'bg-zinc-50 dark:bg-zinc-800';

						if (isConfirmed) {
							cardBorder = 'border-emerald-500 dark:border-emerald-500/50 shadow-sm shadow-emerald-500/10';
							cardBg = 'bg-emerald-50/30 dark:bg-emerald-900/10';
						} else if (isRefused) {
							cardBorder = 'border-red-500 dark:border-red-500/50 opacity-75';
						} else if (isPending && hasBeenMailed) {
							cardBorder = 'border-amber-400 dark:border-amber-500/50';
							cardBg = 'bg-amber-50/30 dark:bg-amber-900/10';
						}

						return (
							<div key={contact.id} className={`flex flex-col p-4 rounded-xl border transition-all ${cardBorder} ${cardBg}`}>
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium text-zinc-900 dark:text-zinc-100">{contact.name}</p>
										<div className="text-xs text-zinc-500 flex flex-wrap items-center gap-3 mt-1.5">
											{contact.email && (
												<span className="flex items-center gap-1">
													<Mail size={12} /> {contact.email}
												</span>
											)}
											{contact.company && (
												<span className="flex items-center gap-1">
													<Building2 size={12} /> {contact.company}
												</span>
											)}

											{isConfirmed && <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-semibold">Confirmed</span>}
											{isRefused && <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white font-semibold">Declined</span>}
											{isPending && hasBeenMailed && <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-semibold">Pending (Invite Sent)</span>}
											{isPending && !hasBeenMailed && (
												<span className="px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 font-semibold">Pending (Not Sent)</span>
											)}

											<span className="text-xs font-medium text-zinc-400 border-l border-zinc-300 dark:border-zinc-600 pl-3">Sent: {contact.inviteData.inviteCount || 0}</span>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<Button
											size="sm"
											variant={isConfirmed ? 'secondary' : 'primary'}
											icon={<Mail size={14} />}
											onClick={() => handleSendInvite(contact.id)}
											disabled={isConfirmed || isPast}
										>
											{hasBeenMailed ? 'Resend' : 'Send'}
										</Button>
										{!isPast && (
											<>
												{!isConfirmed && (
													<button
														title="Mark as Confirmed (Manual)"
														onClick={() => {
															const inv = contact.inviteData || {};
															setManualGuests(inv.guests || []);
															setManualIsVegetarian(inv.isVegetarian || false);
															setManualAllergies(inv.allergies || '');
															setConfirmModalContactId(contact.id);
														}}
														className="text-emerald-500/70 hover:text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg transition-colors"
													>
														<Check size={18} />
													</button>
												)}
												{!isRefused && (
													<button
														title="Mark as Declined"
														onClick={() => setDeclineContactId(contact.id)}
														className="text-orange-500/70 hover:text-orange-600 p-2 hover:bg-orange-50 rounded-lg transition-colors"
													>
														<Ban size={18} />
													</button>
												)}
												<button
													title="Remove Invite"
													onClick={() => handleRemoveInvite(contact.id)}
													className="text-red-500/70 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
												>
													<Trash2 size={18} />
												</button>
											</>
										)}
									</div>
								</div>

								{/* Diet & Allergies */}
								{(contact.inviteData.isVegetarian || contact.inviteData.allergies) && (
									<div className="mt-3 ml-1 pl-4 border-l-2 border-amber-500/30">
										<p className="text-xs font-semibold text-amber-600 dark:text-amber-500 mb-1.5 uppercase tracking-wider">Dieetwensen & Allergieën</p>
										<div className="text-sm space-y-1">
											{contact.inviteData.isVegetarian && <p className="font-medium text-zinc-800 dark:text-zinc-200">- Vegetarisch</p>}
											{contact.inviteData.allergies && <p className="text-zinc-600 dark:text-zinc-400 italic">"{contact.inviteData.allergies}"</p>}
										</div>
									</div>
								)}

								{/* Guests List */}
								{contact.inviteData.guests?.length > 0 && (
									<div className="mt-3 ml-1 pl-4 border-l-2 border-emerald-500/30">
										<p className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 mb-1.5 uppercase tracking-wider">Additional Guests</p>
										<div className="space-y-1">
											{contact.inviteData.guests.map((g: any, i: number) => (
												<div key={i} className="text-sm flex items-center gap-2">
													<span className="font-medium text-zinc-800 dark:text-zinc-200">{g.name}</span>
													<span className="text-zinc-400">({g.company})</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						);
					})}
					{invitedContacts.length === 0 && <div className="text-sm text-zinc-500 py-4">No one has been invited yet.</div>}
				</div>
			</div>

			{scheduleData.length > 0 && (
				<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-xl font-semibold">Generated Schedule</h2>
							<p className="text-sm text-zinc-500">{confirmedNames.length} total attendees assigned.</p>
						</div>
						<Button onClick={() => exportStyledExcel(scheduleData, confirmedNames)} icon={<Download size={16} />}>
							Download Excel
						</Button>
					</div>

					<div className="space-y-6">
						{scheduleData.map((round) => (
							<motion.div
								key={round.round}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4"
							>
								<div className="flex items-center gap-2">
									<Users size={16} className="text-(--accent)" />
									<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Round {round.round}</h2>
								</div>

								<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
									{round.groups.map((group: any, i: number) => (
										<div key={i} className="border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-4 bg-white dark:bg-zinc-900 shadow-sm space-y-2">
											<div className="flex items-center gap-2 text-sm">
												<MapPin size={14} className="text-zinc-400" />
												<span className="font-medium">{group.location}</span>
											</div>

											{group.leader && (
												<div className="flex items-center gap-2 text-sm text-zinc-500">
													<User size={14} />
													{group.leader}
												</div>
											)}

											<div className="text-sm text-zinc-600 dark:text-zinc-300 pt-1 leading-relaxed">{group.people.join(', ')}</div>
										</div>
									))}
								</div>
							</motion.div>
						))}
					</div>
				</div>
			)}

			<Modal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				title="Add Invite"
				size="md"
				footer={
					<>
						<Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
							Cancel
						</Button>
						<Button onClick={handleAddInvite} disabled={saving || !name || !email || !company}>
							{saving ? 'Adding...' : 'Add to Event'}
						</Button>
					</>
				}
			>
				<div className="space-y-4 pt-2 pb-24">
					<div className="relative">
						<Input label="Name" value={name} onChange={handleNameChange} onFocus={() => setShowSuggestions(true)} placeholder="Search or enter full name..." />

						{showSuggestions && suggestions.length > 0 && (
							<div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
								{suggestions.map((c) => (
									<button
										key={c.id}
										onClick={() => handleSelect(c)}
										className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex flex-col transition-colors border-b last:border-0 border-zinc-100 dark:border-zinc-700/50"
									>
										<span className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</span>
										{c.email && <span className="text-xs text-zinc-500">{c.email}</span>}
									</button>
								))}
							</div>
						)}
					</div>
					<Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@address.com" />

					<div className="relative">
						<Input
							label="Company"
							value={company}
							onChange={(e) => {
								setCompany(e.target.value);
								setShowCompanySuggestions(true);
							}}
							onFocus={() => setShowCompanySuggestions(true)}
							placeholder="Company Name"
						/>

						{showCompanySuggestions && companySuggestions.length > 0 && (
							<div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
								{companySuggestions.map((c) => (
									<button
										key={c}
										onClick={() => {
											setCompany(c);
											setShowCompanySuggestions(false);
										}}
										className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex flex-col transition-colors border-b last:border-0 border-zinc-100 dark:border-zinc-700/50"
									>
										<span className="font-medium text-zinc-900 dark:text-zinc-100">{c}</span>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</Modal>

			<Modal
				open={previewModalOpen}
				onClose={() => setPreviewModalOpen(false)}
				title="Customize Email & Preview"
				size="4xl"
				footer={
					<>
						<Button variant="secondary" onClick={() => setPreviewModalOpen(false)}>
							Close
						</Button>
						<Button onClick={handleSaveMail} disabled={mailSaving}>
							{mailSaving ? 'Saving...' : 'Save & Refresh Preview'}
						</Button>
					</>
				}
			>
				<div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-sm text-orange-800 mb-6 flex justify-between items-center">
					<span>
						<strong>Inline Editor:</strong> Click on the dashed text boxes directly inside the email preview to edit them. Your dashboard event name will remain "{event?.name}".
					</span>
				</div>
				<div className="w-full bg-white rounded-xl overflow-hidden shadow-inner border border-zinc-100 dark:border-zinc-800 relative">
					<iframe
						key={previewTimestamp}
						src={`/api/events/${id}/preview-email?t=${previewTimestamp}`}
						className="w-full border-0"
						title="Email Preview"
						scrolling="no"
						style={{ minHeight: '600px' }}
						onLoad={(e) => {
							const iframe = e.target as HTMLIFrameElement;
							try {
								if (iframe.contentWindow?.document?.documentElement) {
									iframe.style.height = iframe.contentWindow.document.documentElement.scrollHeight + 'px';
								}
							} catch (err) {
								console.error('Could not resize iframe', err);
							}
						}}
					/>
				</div>
			</Modal>

			<EventModal open={editModalOpen} onClose={() => setEditModalOpen(false)} onSuccess={load} eventToEdit={event} />

			<Modal
				open={!!confirmModalContactId}
				onClose={() => setConfirmModalContactId(null)}
				title="Manueel Bevestigen"
				size="md"
				footer={
					<>
						<Button variant="secondary" onClick={() => setConfirmModalContactId(null)}>
							Annuleren
						</Button>
						<Button onClick={submitManualConfirm}>Bevestigen</Button>
					</>
				}
			>
				<div className="space-y-6 pt-2">
					<div>
						<h3 className="text-sm font-semibold text-zinc-900 mb-3">Dieetwensen & Allergieën</h3>
						<div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-4">
							<label className="flex items-center gap-3 cursor-pointer">
								<div
									className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${manualIsVegetarian ? 'border-[#a4b795] bg-[#a4b795]' : 'border-zinc-300 bg-white'}`}
								>
									{manualIsVegetarian && <Check size={14} className="text-white" />}
								</div>
								<input type="checkbox" className="hidden" checked={manualIsVegetarian} onChange={(e) => setManualIsVegetarian(e.target.checked)} />
								<span className="font-medium text-sm text-zinc-700">Vegetarisch</span>
							</label>
							<div>
								<label className="block text-xs font-medium text-zinc-500 mb-1">Specifieke allergieën of opmerkingen</label>
								<textarea
									value={manualAllergies}
									onChange={(e) => setManualAllergies(e.target.value)}
									className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-[#a4b795]"
									placeholder="Bijv. glutenvrij..."
									rows={2}
								/>
							</div>
						</div>
					</div>

					<div>
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-sm font-semibold text-zinc-900">Extra gasten (+1)</h3>
							{manualGuests.length < 2 && (
								<button
									onClick={() => setManualGuests([...manualGuests, { name: '', company: '' }])}
									className="text-xs text-[#a4b795] font-medium flex items-center gap-1 hover:underline"
								>
									<Plus size={14} /> Gast toevoegen
								</button>
							)}
						</div>
						<div className="space-y-3">
							{manualGuests.length === 0 && <p className="text-zinc-500 text-xs italic">Geen extra gasten</p>}
							{manualGuests.map((g, i) => (
								<div key={i} className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 relative">
									<button onClick={() => setManualGuests(manualGuests.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-zinc-400 hover:text-red-500">
										<Trash2 size={14} />
									</button>
									<div className="pr-6 space-y-3">
										<div>
											<label className="block text-xs font-medium text-zinc-500 mb-1">Naam gast</label>
											<input
												type="text"
												value={g.name}
												onChange={(e) => {
													const n = [...manualGuests];
													n[i].name = e.target.value;
													setManualGuests(n);
												}}
												className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#a4b795]"
											/>
										</div>
										<div>
											<label className="block text-xs font-medium text-zinc-500 mb-1">Bedrijf</label>
											<input
												type="text"
												value={g.company}
												onChange={(e) => {
													const n = [...manualGuests];
													n[i].company = e.target.value;
													setManualGuests(n);
												}}
												className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#a4b795]"
											/>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</Modal>

			<ConfirmDialog
				open={!!declineContactId}
				title="Decline Guest"
				description="Weet u zeker dat u deze gast wilt weigeren?"
				confirmText="Weigeren"
				cancelText="Annuleren"
				onClose={() => setDeclineContactId(null)}
				onConfirm={() => {
					if (declineContactId) {
						handleMarkDeclined(declineContactId);
						setDeclineContactId(null);
					}
				}}
			/>
		</div>
	);
}
