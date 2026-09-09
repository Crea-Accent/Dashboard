/** @format */
'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import Button from './Button';

type Props = {
	text: string;
	className?: string;
};

export default function CopyButton({ text, className = '' }: Props) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (!text) return;
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={handleCopy}
			className={`!px-2 text-(--text-muted) hover:text-(--text) ${className}`}
			icon={copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
		/>
	);
}
