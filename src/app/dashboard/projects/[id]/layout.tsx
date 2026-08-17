/** @format */

import { Metadata } from 'next';

type Props = {
	children: React.ReactNode;
	params: Promise<{
		id: string;
	}>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;

	return {
		title: `Crea-Accent | ${decodeURIComponent(id)}`,
		description: '',
		icons: {
			icon: '/favicon.svg',
		},
	};
}

export default async function ProjectLayout({ children }: Props) {
	return children;
}
