/** @format */
'use client';

import { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
	children: ReactNode;
};

export default function Card({ children, className = '', ...props }: Props) {
	return (
		<div
			className={`
				rounded-3xl
				bg-(--foreground)
				border
				border-(--border)/10
				shadow-sm
				transition-colors
				${className}
			`}
			{...props}
		>
			{children}
		</div>
	);
}
