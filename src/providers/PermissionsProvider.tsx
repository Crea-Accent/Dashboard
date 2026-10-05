/** @format */
'use client';

import { ReactNode, createContext, useContext } from 'react';

import { PERMISSIONS } from '@/lib/permissions';
import { useSession } from 'next-auth/react';

export type Permission = (typeof PERMISSIONS)[number]['key'];

type PermissionsContextType = {
	permissions: string[];
	loading: boolean;
	has: (perm: Permission) => boolean;
	hasAny: (perms: string[]) => boolean;
	hasAll: (perms: string[]) => boolean;
};

const PermissionsContext = createContext<PermissionsContextType | null>(null);

/* ---------------- PROVIDER ---------------- */

export function PermissionsProvider({ children }: { children: ReactNode }) {
	const { data: session, status } = useSession() as unknown as {
		data: { user: { permissions: string[] } };
		status: string;
	};

	const loading = status === 'loading';

	const permissions: string[] = session?.user?.permissions || [];

	function has(perm: string) {
		if (permissions.includes(perm)) return true;

		/* admin overrides */

		if (perm.endsWith('.read') && (permissions.includes('admin.read') || permissions.includes('admin.write'))) return true;
		if (perm.endsWith('.write') && permissions.includes('admin.write')) return true;

		return false;
	}

	function hasAny(perms: string[]) {
		return perms.some((p) => has(p));
	}

	function hasAll(perms: string[]) {
		return perms.every((p) => has(p));
	}

	return (
		<PermissionsContext.Provider
			value={{
				permissions,
				loading,
				has,
				hasAny,
				hasAll,
			}}
		>
			{children}
		</PermissionsContext.Provider>
	);
}

/* ---------------- HOOK ---------------- */

export function usePermissions() {
	const ctx = useContext(PermissionsContext);
	if (!ctx) throw new Error('usePermissions must be used inside PermissionsProvider');
	return ctx;
}

/* ---------------- NOT PERMITTED COMPONENT ---------------- */

export function NotPermitted({
	permission,
	any,
	all,
	children,
	fallback,
	message,
	shareAccess,
}: {
	permission?: Permission;
	any?: string[];
	all?: string[];
	children?: ReactNode;
	fallback?: ReactNode;
	message?: string;
	shareAccess?: boolean;
}) {
	const { has, hasAny, hasAll, loading } = usePermissions();

	if (loading) return null;

	let allowed = false;
	let conditionsChecked = false;

	if (permission) {
		allowed = allowed || has(permission);
		conditionsChecked = true;
	}
	if (any && any.length > 0) {
		allowed = allowed || hasAny(any);
		conditionsChecked = true;
	}
	if (all && all.length > 0) {
		allowed = allowed || hasAll(all);
		conditionsChecked = true;
	}
	if (shareAccess !== undefined) {
		allowed = allowed || shareAccess;
		conditionsChecked = true;
	}

	if (!conditionsChecked) {
		allowed = true; // Default to allow if no constraints were specified
	}

	if (allowed) return <>{children}</>;

	if (fallback) return <>{fallback}</>;

	return (
		<div className="p-10 flex flex-col items-center justify-center text-center space-y-3">
			<div className="text-lg font-semibold">Access denied</div>

			<p className="text-sm text-zinc-500">{message ?? 'You do not have permission to access this page.'}</p>
		</div>
	);
}
