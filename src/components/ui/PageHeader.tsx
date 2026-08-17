/** @format */
'use client';

import { ReactNode } from 'react';

type Props = {
	icon: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
};

export default function PageHeader({ icon, title, description, action }: Props) {
	return (
		<div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
			<div className="flex min-w-0 items-center gap-4">
				<div
					className="
						flex size-12 shrink-0 items-center justify-center
						rounded-2xl
						bg-(--accent)/15
						text-(--accent)
					"
				>
					{icon}
				</div>

				<div className="min-w-0">
					<h1 className="truncate text-3xl font-bold tracking-tight">{title}</h1>

					{description && <p className="mt-1 text-sm text-(--text-muted)">{description}</p>}
				</div>
			</div>

			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}
