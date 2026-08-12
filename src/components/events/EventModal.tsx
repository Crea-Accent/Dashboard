'use client';

import { useState, useEffect, useRef } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type EventModalProps = {
	open: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	eventToEdit?: any;
};

function LocationAutocomplete({ value, onChange }: { value: string, onChange: (val: string) => void }) {
	const places = useMapsLibrary('places');
	const inputRef = useRef<HTMLInputElement>(null);
	const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);

	useEffect(() => {
		if (!places || !inputRef.current) return;
		autocomplete.current = new places.Autocomplete(inputRef.current, {
			fields: ['formatted_address', 'name'],
		});
		autocomplete.current.addListener('place_changed', () => {
			const place = autocomplete.current?.getPlace();
			if (place?.formatted_address) {
				onChange(place.formatted_address);
			} else if (place?.name) {
				onChange(place.name);
			}
		});
		return () => {
			if (autocomplete.current) {
				google.maps.event.clearInstanceListeners(autocomplete.current);
			}
		};
	}, [places, onChange]);

	return (
		<Input
			ref={inputRef}
			label="Location"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder="Search for a location..."
		/>
	);
}

function EventModalContent({ open, onClose, onSuccess, eventToEdit }: EventModalProps) {
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [date, setDate] = useState('');
	const [welcomeTime, setWelcomeTime] = useState('');
	const [startTime, setStartTime] = useState('');
	const [endTime, setEndTime] = useState('');
	const [location, setLocation] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (open && eventToEdit) {
			setName(eventToEdit.name || '');
			setDescription(eventToEdit.description || '');
			setDate(eventToEdit.date || '');
			setWelcomeTime(eventToEdit.welcomeTime || eventToEdit.time || '');
			setStartTime(eventToEdit.startTime || '');
			setEndTime(eventToEdit.endTime || '');
			setLocation(eventToEdit.location || '');
		} else if (open && !eventToEdit) {
			setName('');
			setDescription('');
			setDate('');
			setWelcomeTime('');
			setStartTime('');
			setEndTime('');
			setLocation('');
		}
	}, [open, eventToEdit]);

	const handleSave = async () => {
		try {
			setSaving(true);
			
			const method = eventToEdit ? 'PATCH' : 'POST';
			const url = eventToEdit ? `/api/events/${eventToEdit.id}` : '/api/events';
			const body = eventToEdit 
				? JSON.stringify({
					updates: { name, description, date, welcomeTime, startTime, endTime, location }
				  })
				: JSON.stringify({
					event: { name, description, date, welcomeTime, startTime, endTime, location, invites: [] }
				  });

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body
			});
			if (response.ok) {
				onClose();
				if (onSuccess) onSuccess();
				// Reset form
				setName('');
				setDescription('');
				setDate('');
				setWelcomeTime('');
				setStartTime('');
				setEndTime('');
				setLocation('');
			} else {
				alert('Failed to save event');
			}
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={eventToEdit ? 'Edit Event' : 'Create New Event'}
			size="md"
			footer={
				<>
					<Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
					<Button onClick={handleSave} disabled={saving || !name || !date || !welcomeTime || !startTime || !endTime}>
						{saving ? 'Saving...' : eventToEdit ? 'Save Changes' : 'Create Event'}
					</Button>
				</>
			}
		>
			<div className="space-y-4 pt-2">
				<Input
					label="Event Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="E.g. Annual Company Retreat"
				/>
				<div>
					<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="What is this event about?"
						className="w-full h-20 bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-(--accent) focus:ring-1 focus:ring-(--accent)"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<Input
						label="Date"
						type="date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
					/>
					<LocationAutocomplete value={location} onChange={setLocation} />
				</div>
				<div className="grid grid-cols-3 gap-4">
					<Input
						label="Welcome"
						type="time"
						value={welcomeTime}
						onChange={(e) => setWelcomeTime(e.target.value)}
					/>
					<Input
						label="Start"
						type="time"
						value={startTime}
						onChange={(e) => setStartTime(e.target.value)}
					/>
					<Input
						label="End"
						type="time"
						value={endTime}
						onChange={(e) => setEndTime(e.target.value)}
					/>
				</div>
			</div>
		</Modal>
	);
}

export default function EventModal(props: EventModalProps) {
	if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
		return <EventModalContent {...props} />;
	}
	return (
		<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} libraries={['places']}>
			<EventModalContent {...props} />
		</APIProvider>
	);
}
