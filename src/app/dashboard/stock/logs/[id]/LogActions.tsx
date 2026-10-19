/** @format */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useToast } from '@/providers/ToastProvider';

export default function LogActions({ logId }: { logId: string }) {
	const router = useRouter();
	const toast = useToast();
	const [reverting, setReverting] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const handleRevert = async () => {
		if (!confirm('Create a compensating stock booking that reverses all quantities in this log?')) return;
		setReverting(true);
		try {
			const res = await fetch(`/api/stock/logs/${encodeURIComponent(logId)}`, {
				method: 'POST',
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.success) {
				toast('success', 'Booking reverted with a compensating stock entry');
				router.push(`/dashboard/stock/logs/${encodeURIComponent(data.newId)}`);
				router.refresh();
			} else {
				toast('error', data.error || 'Failed to revert booking');
			}
		} catch {
			toast('error', 'Error reverting booking');
		} finally {
			setReverting(false);
		}
	};

	const handleDelete = async () => {
		if (!confirm('Permanently delete this stock log file? This will immediately recalculate stock levels.')) return;
		setDeleting(true);
		try {
			const res = await fetch(`/api/stock/logs/${encodeURIComponent(logId)}`, {
				method: 'DELETE',
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.success) {
				toast('success', 'Stock log deleted');
				router.push('/dashboard/stock/logs');
				router.refresh();
			} else {
				toast('error', data.error || 'Failed to delete log');
			}
		} catch {
			toast('error', 'Error deleting log');
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div className="flex items-center gap-2">
			<Button variant="secondary" icon={<RotateCcw size={15} />} onClick={handleRevert} loading={reverting} disabled={deleting} title="Create an opposite booking that reverses these quantities">
				<span className="hidden sm:inline">Revert Booking</span>
				<span className="sm:hidden">Revert</span>
			</Button>

			<Button variant="danger" icon={<Trash2 size={15} />} onClick={handleDelete} loading={deleting} disabled={reverting} title="Delete this log file permanently">
				<span className="hidden sm:inline">Delete Log</span>
			</Button>
		</div>
	);
}
