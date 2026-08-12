'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, X, Plus, Trash2, Calendar, MapPin, Clock } from 'lucide-react';

export default function InvitePage() {
	const params = useParams();
	const eventId = params.eventId as string;
	const contactId = params.contactId as string;

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const [event, setEvent] = useState<any>(null);
	const [contact, setContact] = useState<any>(null);

	const [status, setStatus] = useState<'pending' | 'confirmed' | 'refused'>('pending');
	const [guests, setGuests] = useState<{ name: string; company: string }[]>([]);

	useEffect(() => {
		async function load() {
			try {
				const res = await fetch(`/api/public/events/${eventId}/${contactId}`);
				if (!res.ok) {
					setError('Uitnodiging niet gevonden of vervallen.');
					return;
				}
				const data = await res.json();
				setEvent(data.event);
				setContact(data.contact);
				setStatus(data.invite.status || 'pending');
				setGuests(data.invite.guests || []);
			} catch (err) {
				setError('Er is een fout opgetreden.');
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [eventId, contactId]);

	const addGuest = () => {
		if (guests.length >= 2) return;
		setGuests([...guests, { name: '', company: '' }]);
	};

	const removeGuest = (index: number) => {
		setGuests(guests.filter((_, i) => i !== index));
	};

	const updateGuest = (index: number, field: 'name' | 'company', value: string) => {
		const newGuests = [...guests];
		newGuests[index][field] = value;
		setGuests(newGuests);
	};

	const handleSubmit = async () => {
		if (status === 'pending') return;

		setSubmitting(true);
		try {
			const res = await fetch(`/api/public/events/${eventId}/${contactId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status, guests: status === 'confirmed' ? guests : [] }),
			});
			if (!res.ok) throw new Error();
			setSuccess(true);
		} catch (err) {
			alert('Er is een fout opgetreden bij het opslaan.');
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center font-sans">
				<div className="animate-pulse flex flex-col items-center gap-4">
					<div className="h-8 w-8 rounded-full border-4 border-[#a4b795] border-t-transparent animate-spin"></div>
					<p className="text-zinc-500">Laden...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-[#f5f5f5] p-6 flex flex-col items-center justify-center font-sans">
				<div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm text-center">
					<div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
						<X size={32} />
					</div>
					<h1 className="text-2xl font-bold text-zinc-900 mb-2">Oeps!</h1>
					<p className="text-zinc-500">{error}</p>
				</div>
			</div>
		);
	}

	if (success) {
		return (
			<div className="min-h-screen bg-[#f5f5f5] p-6 flex flex-col items-center justify-center font-sans">
				<div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-[0_4px_15px_rgba(0,0,0,0.05)] text-center">
					<div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
						<Check size={32} />
					</div>
					<h1 className="text-2xl font-bold text-zinc-900 mb-2">Bedankt, {contact?.name}!</h1>
					<p className="text-zinc-500">
						Uw keuze is succesvol doorgegeven.{' '}
						{status === 'confirmed' && 'We kijken ernaar uit u te zien.'}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f5f5f5] p-4 sm:p-8 flex flex-col items-center font-sans">
			<div className="max-w-xl w-full bg-white rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
				{/* Header */}
				<div className="bg-[#a4b795]/10 p-8 text-center border-b border-[#a4b795]/20">
					<h1 className="text-3xl font-bold text-zinc-900 mb-2">{event.name}</h1>
					{event.description && <p className="text-sm text-zinc-600 mb-4">{event.description}</p>}
					<p className="text-zinc-600 font-medium">Hallo {contact?.name}, u bent uitgenodigd!</p>
				</div>

				<div className="p-8 space-y-8">
					{/* Event Details */}
					<div className="bg-zinc-50 rounded-2xl p-6 space-y-4">
						<div className="flex items-center gap-3 text-zinc-700">
							<Calendar className="text-[#a4b795]" size={20} />
							<span className="font-medium">{event.date}</span>
						</div>
						
						{event.welcomeTime && (
							<div className="flex items-center gap-3 text-zinc-700">
								<Clock className="text-[#a4b795]" size={20} />
								<span className="font-medium">Welkom: {event.welcomeTime}</span>
							</div>
						)}
						{event.startTime && (
							<div className="flex items-center gap-3 text-zinc-700">
								<Clock className="text-[#a4b795]" size={20} />
								<span className="font-medium">Start: {event.startTime}</span>
							</div>
						)}
						{event.time && !event.welcomeTime && (
							<div className="flex items-center gap-3 text-zinc-700">
								<Clock className="text-[#a4b795]" size={20} />
								<span className="font-medium">{event.time}</span>
							</div>
						)}
						{event.location && (
							<div className="flex items-center gap-3 text-zinc-700">
								<MapPin className="text-[#a4b795]" size={20} />
								<span className="font-medium">{event.location}</span>
							</div>
						)}
					</div>

					{/* RSVP Choice */}
					<div className="space-y-4">
						<h3 className="font-semibold text-lg text-zinc-900">Aanwezigheid</h3>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<button
								onClick={() => setStatus('confirmed')}
								className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
									status === 'confirmed'
										? 'border-[#a4b795] bg-[#a4b795]/10 text-zinc-900'
										: 'border-zinc-200 text-zinc-500 hover:border-[#a4b795]/50'
								}`}
							>
								<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${status === 'confirmed' ? 'border-[#a4b795]' : 'border-zinc-300'}`}>
									{status === 'confirmed' && <div className="w-2.5 h-2.5 bg-[#a4b795] rounded-full" />}
								</div>
								<span className="font-medium">Ik ben aanwezig</span>
							</button>

							<button
								onClick={() => setStatus('refused')}
								className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
									status === 'refused'
										? 'border-red-400 bg-red-50 text-zinc-900'
										: 'border-zinc-200 text-zinc-500 hover:border-red-200'
								}`}
							>
								<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${status === 'refused' ? 'border-red-400' : 'border-zinc-300'}`}>
									{status === 'refused' && <div className="w-2.5 h-2.5 bg-red-400 rounded-full" />}
								</div>
								<span className="font-medium">Ik kan niet komen</span>
							</button>
						</div>
					</div>

					{/* +1 Section */}
					{status === 'confirmed' && (
						<div className="space-y-4 pt-6 border-t border-zinc-100">
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-lg text-zinc-900">Extra gasten (+1)</h3>
								{guests.length < 2 && (
									<button
										onClick={addGuest}
										className="text-sm font-medium text-[#a4b795] hover:text-[#8fa37f] flex items-center gap-1"
									>
										<Plus size={16} />
										Gast toevoegen
									</button>
								)}
							</div>

							{guests.length === 0 ? (
								<p className="text-zinc-500 text-sm">U kunt maximaal 2 extra gasten meebrengen.</p>
							) : (
								<div className="space-y-4">
									{guests.map((guest, index) => (
										<div key={index} className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 relative group">
											<button
												onClick={() => removeGuest(index)}
												className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 transition-colors"
											>
												<Trash2 size={16} />
											</button>
											<div className="pr-8 space-y-4">
												<div>
													<label className="block text-xs font-medium text-zinc-500 mb-1">Naam gast</label>
													<input
														type="text"
														value={guest.name}
														onChange={(e) => updateGuest(index, 'name', e.target.value)}
														className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#a4b795] focus:ring-1 focus:ring-[#a4b795]"
														placeholder="Naam en achternaam"
													/>
												</div>
												<div>
													<label className="block text-xs font-medium text-zinc-500 mb-1">Bedrijf</label>
													<input
														type="text"
														value={guest.company}
														onChange={(e) => updateGuest(index, 'company', e.target.value)}
														className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#a4b795] focus:ring-1 focus:ring-[#a4b795]"
														placeholder="Bedrijfsnaam"
													/>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Action */}
					<div className="pt-6">
						<button
							onClick={handleSubmit}
							disabled={submitting || status === 'pending' || (status === 'confirmed' && guests.some(g => !g.name.trim() || !g.company.trim()))}
							className={`w-full py-4 rounded-full font-bold text-lg shadow-[0_10px_28px_rgba(164,183,149,0.35)] transition-all ${
								submitting || status === 'pending' || (status === 'confirmed' && guests.some(g => !g.name.trim() || !g.company.trim()))
									? 'bg-zinc-300 text-zinc-500 cursor-not-allowed shadow-none'
									: 'bg-[#a4b795] text-white hover:bg-[#8fa37f] hover:-translate-y-0.5'
							}`}
						>
							{submitting ? 'Even geduld...' : 'Bevestigen'}
						</button>
					</div>
				</div>
			</div>
			
			<div className="mt-12 text-center flex flex-col items-center">
				<div className="flex items-center justify-center gap-4 mb-6">
					<a href="https://www.crea-accent.be" target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
						<img src="/website.png" alt="Website" className="w-8 h-8" />
					</a>
					<a href="https://www.instagram.com/crea.accent/" target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
						<img src="/instagram.png" alt="Instagram" className="w-8 h-8" />
					</a>
					<a href="https://www.linkedin.com/company/crea-accent" target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
						<img src="/linkedin.png" alt="LinkedIn" className="w-8 h-8" />
					</a>
					<a href="https://www.facebook.com/Crea.Accent.Verlichting" target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
						<img src="/facebook.png" alt="Facebook" className="w-8 h-8" />
					</a>
				</div>
			</div>
		</div>
	);
}
