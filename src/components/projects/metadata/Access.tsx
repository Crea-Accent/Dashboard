/** @format */
'use client';

import { User as UserIcon, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import { User } from 'next-auth';

type Props = {
	users: User[];
	value: string[];
	onChange: (value: string[]) => void;
};

export default function Access({ users, value, onChange }: Props) {
	const [query, setQuery] = useState('');

	const filtered = useMemo(() => {
		if (!query.trim()) {
			return [];
		}

		const q = query.toLowerCase();

		return users.filter((user) => !value.includes(user.id) && (user.name?.toLowerCase().includes(q) || user.email?.toLowerCase().includes(q))).slice(0, 8);
	}, [users, value, query]);

	function add(id: string) {
		if (value.includes(id)) return;

		onChange([...value, id]);

		setQuery('');
	}

	function remove(id: string) {
		onChange(value.filter((x) => x !== id));
	}

	return (
		<div className="space-y-4">
			<Input label="" placeholder="Search users..." value={query} onChange={(e) => setQuery(e.target.value)} />

			{filtered.length > 0 && (
				<div className="rounded-3xl overflow-hidden bg-(--foreground)">
					{filtered.map((user) => (
						<Button variant="secondary" key={user.id} type="button" onClick={() => add(user.id)} className="w-full justify-start">
							<div className="font-medium">{user.name || 'Unnamed User'}</div>

							<div className="text-sm text-(--text-muted)">{user.email}</div>
						</Button>
					))}
				</div>
			)}

			{value.length === 0 && <EmptyState title="" description="No users have access yet." />}

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
				{value.map((id) => {
					const user = users.find((x) => x.id === id);

					if (!user) return null;

					return (
						<div key={id} className="rounded-3xl p-4 flex flex-col bg-(--accent)/10 text-white border: border-2 border-(--accent)/70 ">
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-(--background) text-(--text)">
									<UserIcon size={16} />
								</div>

								<div className="flex-1 min-w-0">
									<div className="font-medium truncate text-(--text)">{user.name || 'Unnamed User'}</div>

									<div className="text-xs truncate text-(--text-muted)">{user.email}</div>
								</div>
							</div>

							<div className="mt-4">
								<Button variant={'primary'} onClick={() => remove(id)} className="w-full">
									<span className="flex items-center justify-center gap-2">
										<X size={14} />
										Remove Access
									</span>
								</Button>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
