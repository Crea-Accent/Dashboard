/** @format */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardList, Folder, FolderArchive, FolderKanban, Home, House, KeyRound, ListTodo, LogIn, LogOut, Menu, Network, Package, Settings, User } from 'lucide-react';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from '@/lib/layout';
import { signIn, signOut, useSession } from 'next-auth/react';

import Button from './ui/Button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/providers/PermissionsProvider';
import { useSidebar } from '../providers/SidebarProvider';

export default function Sidebar({ type = 'dashboard', items = [] }: any) {
	const pathname = usePathname() || '';
	const { open, setOpen, toggle } = useSidebar();
	const { data: session, status } = useSession();
	const { has, loading } = usePermissions();

	const navItems =
		type == 'dashboard'
			? [
					{ href: '/dashboard', label: 'Home', icon: Home },
					{
						href: '/dashboard/tasks',
						label: 'Tasks',
						icon: ListTodo,
						permission: 'projects.read',
					},
					{
						href: '/dashboard/projects',
						label: 'Projects',
						icon: FolderKanban,
						permission: 'projects.read',
					},
					{
						href: '/dashboard/files',
						label: 'Files',
						icon: Folder,
						permission: 'files.read',
					},
					{
						href: '/dashboard/procedures',
						label: 'Procedures',
						icon: ClipboardList,
						permission: 'projects.read',
					},
					{
						href: '/dashboard/apps',
						label: 'Apps',
						icon: Package,
						permission: 'applications.read',
					},
					{
						href: '/dashboard/passwords',
						label: 'Passwords',
						icon: KeyRound,
						permission: 'passwords.read',
					},
					{
						href: '/dashboard/workspace',
						label: 'Workspace',
						icon: FolderArchive,
						permission: 'files.read',
					},
					{
						href: '/dashboard/events',
						label: 'Events',
						icon: Network,
						permission: 'events.read',
					},
					{
						href: '/dashboard/settings',
						label: 'Settings',
						icon: Settings,
						permission: 'admin.read',
					},
				]
			: [
					{ href: '/portal', label: 'List', icon: Menu },
					...items.map((item: any) => ({
						href: item.href,
						label: item.label,
						icon: House,
						permission: 'client.read',
					})),
				];

	const visibleItems = navItems.filter((item) => !item.permission || has(item.permission as any));

	if (!session && status !== 'loading') {
		setOpen(false);
		return null;
	}

	if (loading) return null;

	return (
		<AnimatePresence>
			{open && (
				<>
					{/* Mobile Overlay */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={toggle}
						className="fixed left-0 right-0 bottom-0 z-40 md:hidden backdrop-blur-md"
						style={{
							top: HEADER_HEIGHT,
							background: 'rgb(0 0 0 / 0.25)',
						}}
					/>

					{/* Sidebar */}
					<motion.aside
						initial={{ x: -SIDEBAR_WIDTH }}
						animate={{ x: 0 }}
						exit={{ x: -SIDEBAR_WIDTH }}
						transition={{ duration: 0.25 }}
						className="fixed left-0 z-50 p-4 flex flex-col backdrop-blur-xl"
						style={{
							width: SIDEBAR_WIDTH,
							top: HEADER_HEIGHT,
							height: `calc(100dvh - ${HEADER_HEIGHT}px)`,
							background: 'color-mix(in srgb, var(--foreground) 96%, transparent)',
						}}
					>
						{/* Navigation */}
						<nav>
							<ul className="space-y-2">
								{visibleItems.map((item) => (
									<NavItem key={item.href} href={item.href} label={item.label} Icon={item.icon} currentPath={pathname} />
								))}
							</ul>
						</nav>

						<div className="flex-1" />

						{/* Account Section */}
						<div className="relative pt-6 space-y-3">
							{session ? (
								<>
									{/* User Info */}
									<div className="flex items-center gap-3 px-2">
										<div
											className="flex size-12 items-center justify-center rounded-2xl font-semibold"
											style={{
												background: 'color-mix(in srgb, var(--accent) 20%, var(--foreground))',
												color: 'var(--accent)',
											}}
										>
											{session.user?.name?.[0] ?? session.user?.email?.[0]}
										</div>

										<div className="flex-1 min-w-0">
											<p className="truncate font-semibold">{session.user?.name ?? 'Account'}</p>
											<p className="truncate text-sm text-(--text-muted)">{session.user?.email}</p>
										</div>
									</div>

									{/* Account Button */}
									<Link href="/account">
										<Button className="w-full flex justify-start" variant="ghost">
											<User size={16} strokeWidth={1.8} />
											Account
										</Button>
									</Link>

									{/* Logout */}
									<Button className="w-full flex justify-start" variant="danger-ghost" onClick={() => signOut()}>
										<LogOut size={16} strokeWidth={1.8} />
										Log out
									</Button>
								</>
							) : (
								<Button onClick={() => signIn()}>
									<LogIn size={16} strokeWidth={1.8} />
									Login
								</Button>
							)}
						</div>
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	);
}

function NavItem({ href, label, Icon, currentPath }: { href: string; label: string; Icon: React.ElementType; currentPath: string }) {
	const isActive = href === '/dashboard' ? currentPath === '/dashboard' : currentPath.startsWith(href);

	return (
		<li className="relative">
			<Link
				href={href}
				style={
					isActive
						? {
								background: 'color-mix(in srgb, var(--accent) 15%, var(--foreground))',
								color: 'var(--accent)',
							}
						: undefined
				}
				className="
		group
		relative
		flex
		h-11
		items-center
		gap-3
		rounded-2xl
		px-4
		text-sm
		font-medium
		transition-all
		duration-200
		hover:bg-(--foreground)
		hover:translate-x-1
	"
			>
				{isActive && <motion.div layoutId="sidebar-active" className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-(--accent)" />}

				<Icon
					size={16}
					strokeWidth={1.8}
					className={`
						${isActive ? 'text-(--accent)' : 'text-(--text-muted)'}
					`}
				/>

				{label}
			</Link>
		</li>
	);
}
