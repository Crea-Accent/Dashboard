/** @format */
'use client';

import { Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Selector from '@/components/ui/Selector';
import Toggle from '@/components/ui/Toggle';
import { useSession } from 'next-auth/react';
import { useUpload } from '@/providers/UploadProvider';

type TicketModalProps = {
	open: boolean;
	client: string;
	users: any[];
	existingTicket?: any;
	onClose: () => void;
};

type POIState = {
	id: string;
	description: string;
	technician: string;
	requiresPicture: boolean;
	file: File | null;
	filePreview: string | null;
};

export default function TicketModal({ open, client, users, existingTicket, onClose }: TicketModalProps) {
	const { data: session } = useSession();
	const { uploadFile, uploading } = useUpload();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [name, setName] = useState('');
	const [activePOIIndex, setActivePOIIndex] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);

	const currentUsername = session?.user?.name || 'Unknown User';

	const [pois, setPOIs] = useState<POIState[]>([
		{
			id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
			description: '',
			technician: '',
			requiresPicture: false,
			file: null,
			filePreview: null,
		},
	]);

	const handleAddPOI = () => {
		setPOIs((curr) => [
			...curr,
			{
				id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
				description: '',
				technician: '',
				requiresPicture: false,
				file: null,
				filePreview: null,
			},
		]);
	};

	const handleRemovePOI = (id: string) => {
		setPOIs((curr) => curr.filter((p) => p.id !== id));
	};

	const handlePOIChange = (id: string, field: keyof POIState, value: any) => {
		setPOIs((curr) => curr.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || activePOIIndex === null) return;

		const preview = URL.createObjectURL(file);
		const poiId = pois[activePOIIndex].id;

		setPOIs((curr) => curr.map((p) => (p.id === poiId ? { ...p, file, filePreview: preview } : p)));
		
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
		setActivePOIIndex(null);
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			
			const ticketId = existingTicket ? existingTicket.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
			const finalPOIs = [];

			for (const poi of pois) {
				let imagePath = undefined;

				if (poi.file) {
					// Upload the image
					const filename = `${poi.id}_${poi.file.name.replace(/\s+/g, '_')}`;
					const savedAs = await uploadFile(poi.file, client, `tickets/${ticketId}` as any, { name: filename });
					imagePath = savedAs || undefined;
				}

				finalPOIs.push({
					id: poi.id,
					description: poi.description,
					technician: poi.technician,
					requiresPicture: poi.requiresPicture,
					state: 'unfinished',
					imagePath,
				});
			}

			if (existingTicket) {
				const updatedPOIs = [...existingTicket.pois, ...finalPOIs].map((p, i) => ({ ...p, importance: i + 1 }));
				await fetch('/api/projects/tickets', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						client,
						ticketId: existingTicket.id,
						updates: { pois: updatedPOIs },
					}),
				});
			} else {
				const newTicket = {
					id: ticketId,
					name: name.trim(),
					openedBy: currentUsername,
					pois: finalPOIs.map((p, i) => ({ ...p, importance: i + 1 })),
				};

				await fetch('/api/projects/tickets', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						client,
						ticket: newTicket,
					}),
				});
			}

			onClose();
			
			// Cleanup
			setName('');
			setPOIs([
				{
					id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
					description: '',
					technician: '',
					requiresPicture: false,
					file: null,
					filePreview: null,
				},
			]);
		} catch (error) {
			console.error('Failed to create ticket', error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			open={open}
			title={existingTicket ? 'Add Points of Interest' : 'New Ticket'}
			size='lg'
			onClose={onClose}
			footer={
				<>
					<Button variant='secondary' onClick={onClose} disabled={saving || uploading}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saving || uploading || (!existingTicket && !name.trim()) || pois.some((p) => !p.description.trim())}>
						{saving || uploading ? 'Saving...' : existingTicket ? 'Add POI(s)' : 'Create Ticket'}
					</Button>
				</>
			}>
			<div className='space-y-6 max-h-[70vh] overflow-y-auto px-1'>
				{/* Hidden file input */}
				<input
					type='file'
					accept='image/*'
					capture='environment'
					className='hidden'
					ref={fileInputRef}
					onChange={handleFileChange}
				/>

				<div className='bg-(--background) p-4 rounded-2xl border border-(--border)/10 text-sm'>
					{!existingTicket && (
						<div className="mb-4">
							<Input
								label="Ticket Name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="E.g. Ground floor maintenance..."
							/>
						</div>
					)}
					<p>
						<span className='text-(--text-muted)'>Opened by:</span> <span className='font-medium'>{currentUsername}</span>
					</p>
					<p className='mt-1'>
						<span className='text-(--text-muted)'>Date:</span> <span className='font-medium'>{new Date().toLocaleDateString()}</span>
					</p>
				</div>

				<div className='space-y-4'>
					<h3 className='font-semibold'>Points of Interest</h3>

					{pois.map((poi, index) => (
						<div key={poi.id} className='bg-(--foreground) p-4 rounded-2xl border border-(--border)/10 space-y-4 relative'>
							{pois.length > 1 && (
								<button
									onClick={() => handleRemovePOI(poi.id)}
									className='absolute top-3 right-3 text-(--text-muted) hover:text-red-500 transition-colors'>
									<X size={16} />
								</button>
							)}

							<div>
								<Input
									label='Description'
									value={poi.description}
									onChange={(e) => handlePOIChange(poi.id, 'description', e.target.value)}
									placeholder='Describe the issue or task...'
								/>
							</div>

							<div className='grid grid-cols-1 gap-4'>
								<div>
									<label className='text-sm font-medium text-(--text) block mb-2'>Technician</label>
									<Selector
										value={poi.technician}
										onChange={(v) => handlePOIChange(poi.id, 'technician', v)}
										options={[
											{ label: 'Unassigned', value: '' },
											...users.map((u) => ({ label: u.name || u.username || u.id, value: u.username || u.name || u.id })),
										]}
									/>
								</div>

							</div>

							<div className='py-2 border-t border-(--border)/10'>
								<Toggle
									checked={poi.requiresPicture}
									onChange={(checked) => handlePOIChange(poi.id, 'requiresPicture', checked)}
									label='Require Proof Picture'
									description='The technician must upload a picture when marking this task as done.'
								/>
							</div>

							<div className='flex items-center gap-4 pt-2'>
								<Button
									variant='secondary'
									size='sm'
									icon={<ImageIcon size={16} />}
									onClick={() => {
										setActivePOIIndex(index);
										fileInputRef.current?.click();
									}}>
									{poi.file ? 'Change Photo' : 'Take / Upload Photo'}
								</Button>

								{poi.filePreview && (
									<div className='relative'>
										<img src={poi.filePreview} alt='Preview' className='h-12 w-12 object-cover rounded-lg border border-(--border)/10' />
										<button
											onClick={() => {
												handlePOIChange(poi.id, 'file', null);
												handlePOIChange(poi.id, 'filePreview', null);
											}}
											className='absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600'>
											<X size={12} />
										</button>
									</div>
								)}
							</div>
						</div>
					))}
				</div>

				<Button variant='ghost' className='w-full' icon={<Plus size={16} />} onClick={handleAddPOI}>
					Add another point of interest
				</Button>
			</div>
		</Modal>
	);
}
