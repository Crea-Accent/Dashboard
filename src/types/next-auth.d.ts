/** @format */

import { DefaultSession } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';
export type Role = {
	id: string;
	name: string;
	companyId: string;
	defaultPermissions: string[];
};

export type Theme = 'light' | 'dark' | 'system';

export type BaseUser = {
	id: string;
	name: string;
	email: string;
	passwordHash?: string;
	roleId?: string;
	companyId?: string;
	permissions?: string[];
	theme?: Theme;
	projects?: string[];
	preferences?: {
		projectPrompts?: boolean;
		debugMode?: boolean;
		defaultView?: 'list' | 'grid';
	};
};
declare module 'next-auth' {
	interface Session {
		user: BaseUser & DefaultSession['user'];
	}

	interface User extends BaseUser {}
}

declare module 'next-auth/jwt' {
	interface JWT extends DefaultJWT {
		id: string;
		roleId?: string;
		companyId?: string;
		permissions?: string[];
		theme?: 'light' | 'dark' | 'system';
		projects: string[];
		preferences: {
			projectPrompts?: boolean;
			debugMode?: boolean;
			defaultView?: 'list' | 'grid';
		};
	}
}
