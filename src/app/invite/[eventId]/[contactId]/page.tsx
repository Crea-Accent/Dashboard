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
	const [mail, setMail] = useState<any>(null);
	const [contact, setContact] = useState<any>(null);
	const [bannerUrl, setBannerUrl] = useState<string | null>(null);

	const [status, setStatus] = useState<'pending' | 'confirmed' | 'refused'>('pending');
	const [guests, setGuests] = useState<{ name: string; company: string }[]>([]);
	const [isVegetarian, setIsVegetarian] = useState(false);
	const [allergies, setAllergies] = useState('');
	const isPastDeadline = event?.confirmationDate ? new Date() > new Date(`${event.confirmationDate}T23:59:59`) : false;

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
				setMail(data.mail);
				setContact(data.contact);
				setBannerUrl(data.bannerUrl || null);
				setStatus(data.invite.status || 'pending');
				setGuests(data.invite.guests || []);
				setIsVegetarian(data.invite.isVegetarian || false);
				setAllergies(data.invite.allergies || '');
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
				body: JSON.stringify({
					status,
					guests: status === 'confirmed' ? guests : [],
					isVegetarian: status === 'confirmed' ? isVegetarian : false,
					allergies: status === 'confirmed' ? allergies : '',
				}),
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
			<div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center font-sans text-zinc-900">
				<div className="animate-pulse flex flex-col items-center gap-4">
					<div className="h-8 w-8 rounded-full border-4 border-[#a4b795] border-t-transparent animate-spin"></div>
					<p className="text-zinc-500">Laden...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-[#f5f5f5] p-6 flex flex-col items-center justify-center font-sans text-zinc-900">
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
			<div className="min-h-screen bg-[#f5f5f5] p-6 flex flex-col items-center justify-center font-sans text-zinc-900">
				<div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-[0_4px_15px_rgba(0,0,0,0.05)] text-center">
					<div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
						<Check size={32} />
					</div>
					<h1 className="text-2xl font-bold text-zinc-900 mb-2">Bedankt, {contact?.name}!</h1>
					<p className="text-zinc-500">Uw keuze is succesvol doorgegeven. {status === 'confirmed' && 'We kijken ernaar uit u te zien.'}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f5f5f5] p-4 sm:p-8 flex flex-col items-center font-sans text-zinc-900">
			<div className="max-w-4xl w-full bg-white rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
				{/* Header */}
				{bannerUrl && (
					<div className="w-full h-48 sm:h-64 overflow-hidden bg-[#F9F7F3]">
						<img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
					</div>
				)}
				<div className="bg-[#F9F7F3] p-8 text-center border-b border-[#a4b795]/20">
					<h1 className="text-3xl font-bold text-zinc-900 mb-4 font-serif">{mail?.title || event.name}</h1>
					{(mail?.description || event.description) && (
						<div className="text-sm text-zinc-600 space-y-2 max-w-lg mx-auto">
							{(mail?.description || event.description).split('\n').map((p: string, i: number) => (
								<p key={i}>{p}</p>
							))}
						</div>
					)}
				</div>

				<div className="grid lg:grid-cols-2">
					<div className="p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-zinc-100 flex flex-col justify-center">
						{/* Event Details */}
						<div className="bg-zinc-50 rounded-2xl p-6 lg:p-8 space-y-6 lg:space-y-8 h-full">
							<div className="flex items-start gap-4">
								<div className="w-12 h-12 bg-[#a4b795]/10 rounded-full flex items-center justify-center shrink-0">
									<Calendar className="text-[#a4b795]" size={24} />
								</div>
								<div className="space-y-1">
									<p className="font-medium text-zinc-900">{event.date}</p>
									<p className="text-zinc-500 text-sm">{event?.time || `${event?.welcomeTime || ''} ${event?.welcomeTime && event?.endTime ? '-' : ''} ${event?.endTime || ''}`}</p>
									{mail?.dateSubText && (
										<div className="text-sm text-zinc-600 mt-2 italic">
											{mail.dateSubText.split('\n').map((p: string, i: number) => (
												<p key={i}>{p}</p>
											))}
										</div>
									)}
								</div>
							</div>

							{(mail?.programTitle || event.welcomeTime || event.startTime) && (
								<div className="flex items-start gap-4">
									<div className="w-12 h-12 bg-[#a4b795]/10 rounded-full flex items-center justify-center shrink-0">
										<Clock className="text-[#a4b795]" size={24} />
									</div>
									<div className="space-y-2 w-full">
										<p className="font-medium text-zinc-900">{mail?.programTitle || 'PROGRAMMA VAN DE AVOND'}</p>
										<div className="text-sm text-zinc-600 grid grid-cols-[80px_1fr] gap-2">
											{event.welcomeTime && (
												<>
													<span className="font-medium">{event.welcomeTime}</span>
													<span>ontvangst</span>
												</>
											)}
											{event.startTime && (
												<>
													<span className="font-medium">{event.startTime}</span>
													<span>welkomstwoord</span>
												</>
											)}
											{event.networkTime && (
												<>
													<span className="font-medium">{event.networkTime}</span>
													<span>aanvangstijd netwerken</span>
												</>
											)}
											{event.endTime && (
												<>
													<span className="font-medium">{event.endTime}</span>
													<span>einde</span>
												</>
											)}
										</div>
									</div>
								</div>
							)}

							{event.location && (
								<div className="flex items-start gap-4">
									<div className="w-12 h-12 bg-[#a4b795]/10 rounded-full flex items-center justify-center shrink-0">
										<MapPin className="text-[#a4b795]" size={24} />
									</div>
									<div className="space-y-1">
										<p className="font-medium text-zinc-900">Locatie</p>
										<p className="text-zinc-600 text-sm whitespace-pre-wrap">{mail?.locationText || event.location}</p>
									</div>
								</div>
							)}
						</div>
					</div>

					<div className="p-8 lg:p-10 space-y-8 bg-white flex flex-col justify-center">
						{/* RSVP Choice */}
						<div className="space-y-4">
							<div className="text-center space-y-2 mb-6">
								{mail?.confirmText ? (
									<div className="text-zinc-600 font-medium">
										{mail.confirmText.split('\n').map((p: string, i: number) => (
											<p key={i}>{p}</p>
										))}
									</div>
								) : (
									<p className="text-zinc-600 font-medium">Bevestig uw aanwezigheid{event.confirmationDate ? ` uiterlijk voor ${event.confirmationDate}` : ''}</p>
								)}
							</div>
							<h3 className="font-semibold text-lg text-zinc-900">Aanwezigheid</h3>
							{isPastDeadline ? (
								<div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center space-y-2">
									<Clock className="text-orange-500 mx-auto mb-2" size={24} />
									<p className="text-orange-800 font-medium">De deadline om uw aanwezigheid door te geven is verstreken.</p>
									{status === 'confirmed' && (
										<p className="text-sm text-orange-700/80">
											U bent momenteel geregistreerd als <strong>aanwezig</strong>.
										</p>
									)}
									{status === 'refused' && (
										<p className="text-sm text-orange-700/80">
											U bent momenteel geregistreerd als <strong>niet aanwezig</strong>.
										</p>
									)}
									{status === 'pending' && <p className="text-sm text-orange-700/80">U heeft geen keuze doorgegeven.</p>}
								</div>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<button
										onClick={() => setStatus('confirmed')}
										className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
											status === 'confirmed' ? 'border-[#a4b795] bg-[#a4b795]/10 text-zinc-900' : 'border-zinc-200 text-zinc-500 hover:border-[#a4b795]/50'
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
											status === 'refused' ? 'border-red-400 bg-red-50 text-zinc-900' : 'border-zinc-200 text-zinc-500 hover:border-red-200'
										}`}
									>
										<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${status === 'refused' ? 'border-red-400' : 'border-zinc-300'}`}>
											{status === 'refused' && <div className="w-2.5 h-2.5 bg-red-400 rounded-full" />}
										</div>
										<span className="font-medium">Ik kan niet komen</span>
									</button>
								</div>
							)}
						</div>

						{/* +1 Section */}
						{!isPastDeadline && status === 'confirmed' && (
							<div className="space-y-4 pt-6 border-t border-zinc-100">
								<div className="flex items-center justify-between">
									<h3 className="font-semibold text-lg text-zinc-900">Extra gasten (+1)</h3>
								</div>

								<div className="space-y-4">
									{guests.length === 0 && <p className="text-zinc-500 text-sm">U kunt maximaal 2 extra gasten meebrengen.</p>}

									{guests.map((guest, index) => (
										<div key={index} className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 relative group">
											<button onClick={() => removeGuest(index)} className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 transition-colors">
												<Trash2 size={16} />
											</button>
											<div className="pr-8 space-y-4">
												<div>
													<label className="block text-xs font-medium text-zinc-500 mb-1">Naam gast</label>
													<input
														type="text"
														value={guest.name}
														onChange={(e) => updateGuest(index, 'name', e.target.value)}
														className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-[#a4b795] focus:ring-1 focus:ring-[#a4b795]"
														placeholder="Naam en achternaam"
													/>
												</div>
												<div>
													<label className="block text-xs font-medium text-zinc-500 mb-1">Bedrijf</label>
													<input
														type="text"
														value={guest.company}
														onChange={(e) => updateGuest(index, 'company', e.target.value)}
														className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-[#a4b795] focus:ring-1 focus:ring-[#a4b795]"
														placeholder="Bedrijfsnaam"
													/>
												</div>
											</div>
										</div>
									))}

									{guests.length < 2 && (
										<button
											onClick={addGuest}
											className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-[#a4b795]/50 text-[#a4b795] hover:border-[#a4b795] hover:bg-[#a4b795]/5 transition-all font-medium text-lg"
										>
											<Plus size={24} />
											Gast toevoegen
										</button>
									)}
								</div>
							</div>
						)}

						{/* Dietary Requirements */}
						{!isPastDeadline && status === 'confirmed' && (
							<div className="space-y-4 pt-6 border-t border-zinc-100">
								<h3 className="font-semibold text-lg text-zinc-900">Dieetwensen & Allergieën</h3>
								<div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 space-y-4">
									<label className="flex items-center gap-3 cursor-pointer">
										<div
											className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isVegetarian ? 'border-[#a4b795] bg-[#a4b795]' : 'border-zinc-300 bg-white'}`}
										>
											{isVegetarian && <Check size={16} className="text-white" />}
										</div>
										<input type="checkbox" className="hidden" checked={isVegetarian} onChange={(e) => setIsVegetarian(e.target.checked)} />
										<span className="font-medium text-zinc-700">Vegetarisch</span>
									</label>

									<div>
										<label className="block text-sm font-medium text-zinc-700 mb-2">Specifieke allergieën of opmerkingen</label>
										<textarea
											value={allergies}
											onChange={(e) => setAllergies(e.target.value)}
											className="w-full bg-white border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-[#a4b795] focus:ring-1 focus:ring-[#a4b795] min-h-[80px] resize-none"
											placeholder="Bijv. glutenvrij, notenallergie, etc..."
										/>
									</div>
								</div>
							</div>
						)}

						{/* Action */}
						{!isPastDeadline && (
							<div className="pt-6">
								<button
									onClick={handleSubmit}
									disabled={submitting || status === 'pending' || (status === 'confirmed' && guests.some((g) => !g.name.trim() || !g.company.trim()))}
									className={`w-full py-4 rounded-full font-bold text-lg shadow-[0_10px_28px_rgba(164,183,149,0.35)] transition-all ${
										submitting || status === 'pending' || (status === 'confirmed' && guests.some((g) => !g.name.trim() || !g.company.trim()))
											? 'bg-zinc-300 text-zinc-500 cursor-not-allowed shadow-none'
											: 'bg-[#a4b795] text-white hover:bg-[#8fa37f] hover:-translate-y-0.5'
									}`}
								>
									{submitting ? 'Even geduld...' : mail?.rsvpButtonText || 'Bevestigen'}
								</button>
							</div>
						)}
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
