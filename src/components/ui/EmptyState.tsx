/** @format */

type Props = {
	title: string;
	icon?: React.ReactNode;
	description?: string;
	children?: React.ReactNode;
};

export default function EmptyState({ title, description, children, icon = null }: Props) {
	return (
		<div className="rounded-3xl p-8 text-center bg-(--foreground)">
			<div className="flex gap-6 items-center">
				{icon && <div className="flex">{icon}</div>}

				<div className={`flex flex-col ${icon ? 'text-left' : 'text-center'}`}>
					<h2 className="text-lg font-semibold">{title}</h2>

					{description && <p className="mt-2 text-sm text-(--text-muted)">{description}</p>}
				</div>
			</div>

			{children && <div className="mt-6">{children}</div>}
		</div>
	);
}
