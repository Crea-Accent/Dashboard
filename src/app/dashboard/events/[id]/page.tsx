'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, Plus, Mail, Trash2, Mails, Users, MapPin, User, Download, CalendarRange, Edit2, Building2, Calendar, Clock, Play, Square } from 'lucide-react';
import * as XLSX from 'xlsx';
import groupsplit, { leaders } from '@/lib/groupsplit';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Selector from '@/components/ui/Selector';
import { useToast } from '@/providers/ToastProvider';
import EventModal from '@/components/events/EventModal';

export default function EventDetail() {
	const params = useParams();
	const id = params.id as string;
	const toast = useToast();
	const { data: session } = useSession();

	const [event, setEvent] = useState<any>(null);
	const [contacts, setContacts] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const [scheduleData, setScheduleData] = useState<any[]>([]);
	const [confirmedNames, setConfirmedNames] = useState<string[]>([]);

	const [editModalOpen, setEditModalOpen] = useState(false);

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
			const [eventRes, contactsRes, companiesRes] = await Promise.all([fetch(`/api/events/${id}`), fetch('/api/contacts'), fetch('/api/settings/companies')]);

			if (eventRes.ok) {
				const eData = await eventRes.json();
				setEvent(eData.event);
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
		load();
	}, [id]);

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
			</div>

			<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">Invites</h2>
						<p className="text-sm text-zinc-500">{invitedContacts.length} people invited</p>
					</div>
					<div className="flex gap-3">
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
											<button onClick={() => handleRemoveInvite(contact.id)} className="text-red-500/70 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
												<Trash2 size={18} />
											</button>
										)}
									</div>
								</div>

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

			<EventModal open={editModalOpen} onClose={() => setEditModalOpen(false)} onSuccess={load} eventToEdit={event} />
		</div>
	);
}
