/** @format */
'use client';

import { Mail, Phone, Plus, Trash2, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { usePermissions } from '@/providers/PermissionsProvider';

type Props = {
	contacts: string[];
	onChange: (contacts: string[]) => void;
};

export default function Contact({ contacts: selectedContacts, onChange }: Props) {
	const { has } = usePermissions();
	const [contacts, setContacts] = useState<any[]>([]);
	const [editing, setEditing] = useState<number | null>(null);
	const [deleting, setDeleting] = useState<number | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [newContact, setNewContact] = useState({
		name: '',
		role: '',
		company: '',
		phone: '',
		email: '',
	});
	const [search, setSearch] = useState('');
	const [suggestions, setSuggestions] = useState<any[]>([]);

	function updateContact(index: number, key: string, value: string) {
		setContacts((prev) => {
			const updated = structuredClone(prev);

			updated[index] = {
				...updated[index],
				[key]: value,
			};

			return updated;
		});
	}

	async function loadContacts() {
		try {
			if (!selectedContacts.length) {
				setContacts([]);
				return;
			}

			const loaded = await Promise.all(
				selectedContacts.map(async (id) => {
					const response = await fetch(`/api/contacts/${id}`);

					if (!response.ok) {
						return null;
					}

					return response.json();
				})
			);

			setContacts(loaded.filter(Boolean));
		} catch (error) {
			console.error(error);
		}
	}

	async function searchContacts(query: string) {
		try {
			const response = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`);

			if (!response.ok) {
				throw new Error('Failed to search contacts');
			}

			setSuggestions(await response.json());
		} catch (error) {
			console.error(error);
		}
	}

	useEffect(() => {
		const timeout = setTimeout(() => {
			if (!search.trim()) {
				setSuggestions([]);
				return;
			}

			searchContacts(search);
		}, 250);

		return () => clearTimeout(timeout);
	}, [search]);

	useEffect(() => {
		loadContacts();
	}, [selectedContacts]);

	return (
		<div className='flex flex-col gap-4'>
			<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
				{contacts.map((contact, index) => (
					<div key={index} className='rounded-3xl p-4 flex flex-col bg-(--accent)/10 text-(--text) border-2 border-(--accent)/70'>
						<div className='flex items-center gap-3 mb-4'>
							<div className='h-10 w-10 rounded-2xl flex items-center justify-center bg-(--background) text-(--text)'>
								<User size={16} />
							</div>

							<div>
								<div className='font-medium text-(--text)'>{contact.name || 'Unnamed Contact'}</div>

								<div className='text-xs text-(--text-muted)'>
									{contact.company && <span>{contact.company}</span>}
									{contact.company && contact.role && <span> • </span>}
									{contact.role && <span>{contact.role}</span>}
								</div>
							</div>
						</div>

						{editing === index ? (
							<div className='flex flex-col gap-3 flex-1'>
								<Input label='Name' value={contact.name} onChange={(e) => updateContact(index, 'name', e.target.value)} />

								<Input label='Company' value={contact.company || ''} onChange={(e) => updateContact(index, 'company', e.target.value)} />

								<Input label='Role' value={contact.role} onChange={(e) => updateContact(index, 'role', e.target.value)} />

								<Input label='Phone' icon={<Phone size={16} />} value={contact.phone} onChange={(e) => updateContact(index, 'phone', e.target.value)} />

								<Input label='Email' icon={<Mail size={16} />} value={contact.email} onChange={(e) => updateContact(index, 'email', e.target.value)} />
							</div>
						) : (
							<div className='text-sm flex flex-col gap-2 flex-1 text-(--text-muted)'>
								<div className='flex items-center gap-2'>
									<Mail size={14} />
									<span>{contact.email || 'No email'}</span>
								</div>

								<div className='flex items-center gap-2'>
									<Phone size={14} />
									<span>{contact.phone || 'No phone'}</span>
								</div>
							</div>
						)}

						{has('projects.write') && (
							<div className='flex gap-2 mt-4'>
								<Button
									className='flex-1'
									onClick={async () => {
										if (editing === index) {
											const contact = contacts[index];

											await fetch(`/api/contacts/${contact.id}`, {
												method: 'PATCH',
												headers: {
													'Content-Type': 'application/json',
												},
												body: JSON.stringify(contact),
											});

											setEditing(null);

											return;
										}

										setEditing(index);
									}}>
									{editing === index ? 'Save' : 'Edit'}
								</Button>

								<Button variant='danger' onClick={() => setDeleting(index)}>
									<Trash2 size={16} />
								</Button>
							</div>
						)}
					</div>
				))}

				{has('projects.write') && (
					<Button variant='primary-ghost' onClick={() => setCreateOpen(true)} className='rounded-3xl p-4 min-h-55 flex flex-col items-center justify-center gap-2 transition hover:opacity-80'>
						<Plus size={28} />

						<span>Add Contact</span>
					</Button>
				)}
			</div>

			<Modal
				open={createOpen}
				title='New Contact'
				onClose={() => setCreateOpen(false)}
				size='lg'
				footer={
					<>
						<Button variant='secondary' onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>

						<Button
							onClick={async () => {
								const response = await fetch('/api/contacts', {
									method: 'POST',
									headers: {
										'Content-Type': 'application/json',
									},
									body: JSON.stringify(newContact),
								});

								if (!response.ok) {
									throw new Error('Failed to create contact');
								}

								const contact = await response.json();

								if (!selectedContacts.includes(contact.id)) {
									onChange([...selectedContacts, contact.id]);
								}

								setNewContact({
									name: '',
									role: '',
									company: '',
									phone: '',
									email: '',
								});

								setCreateOpen(false);
							}}>
							Create Contact
						</Button>
					</>
				}>
				<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
					<div className='relative'>
						<Input
							label='Name'
							value={newContact.name}
							onChange={(e) => {
								setNewContact({
									...newContact,
									name: e.target.value,
								});

								setSearch(e.target.value);
							}}
						/>

						{suggestions.length > 0 && (
							<div className='absolute z-50 left-0 right-0 mt-2 rounded-3xl overflow-hidden bg-(--foreground)'>
								{suggestions.map((contact) => (
									<Button
										key={contact.id}
										variant='secondary'
										className='w-full justify-start'
										onClick={() => {
											if (selectedContacts.includes(contact.id)) {
												return;
											}

											onChange([...selectedContacts, contact.id]);

											setSuggestions([]);
											setSearch('');
											setCreateOpen(false);
										}}>
										<div className='font-medium'>{contact.name}</div>

										<div className='text-sm text-(--text-muted)'>
											{contact.company ? `${contact.company} ` : ''}
											{contact.email ? `(${contact.email})` : ''}
										</div>
									</Button>
								))}
							</div>
						)}
					</div>

					<Input
						label='Company'
						value={newContact.company}
						onChange={(e) =>
							setNewContact({
								...newContact,
								company: e.target.value,
							})
						}
					/>

					<Input
						label='Role'
						value={newContact.role}
						onChange={(e) =>
							setNewContact({
								...newContact,
								role: e.target.value,
							})
						}
					/>

					<Input
						label='Phone'
						icon={<Phone size={16} />}
						value={newContact.phone}
						onChange={(e) =>
							setNewContact({
								...newContact,
								phone: e.target.value,
							})
						}
					/>

					<Input
						label='Email'
						icon={<Mail size={16} />}
						value={newContact.email}
						onChange={(e) =>
							setNewContact({
								...newContact,
								email: e.target.value,
							})
						}
					/>
				</div>
			</Modal>

			<ConfirmDialog
				open={deleting !== null}
				title='Delete Contact'
				description={`Are you sure you want to delete ${deleting !== null ? contacts[deleting]?.name || 'this contact' : 'this contact'}?`}
				confirmText='Delete'
				onClose={() => setDeleting(null)}
				onConfirm={() => {
					if (deleting === null) return;

					const contact = contacts[deleting];

					onChange(selectedContacts.filter((id) => id !== contact.id));

					if (editing === deleting) {
						setEditing(null);
					}

					setDeleting(null);
				}}
			/>
		</div>
	);
}
