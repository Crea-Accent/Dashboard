/** @format */
'use client';

import { LayoutGrid, List } from 'lucide-react';

import Button from './Button';

type Props = {
	value: 'grid' | 'list';
	onChange: (value: 'grid' | 'list') => void;
};

export default function ViewToggle({ value, onChange }: Props) {
	return (
		<Button variant="secondary" onClick={() => onChange(value === 'grid' ? 'list' : 'grid')}>
			{value === 'grid' ? <LayoutGrid size={16} /> : <List size={16} />}
		</Button>
	);
}
