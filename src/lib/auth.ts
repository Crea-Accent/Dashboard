/** @format */

import Credentials from "next-auth/providers/credentials";
import { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import { getUsers } from "@/lib/users";

export const authConfig: NextAuthOptions = {
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
    signOut: "/auth/logout",
  },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const users = await getUsers();
        const user = users.find(
          (u) => u.email?.toLowerCase() === credentials.email.toLowerCase(),
        );

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );

        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          companyId: user.companyId,
          permissions: user.permissions,
          theme: user.theme || "system",
          projects: user.projects || [],
          preferences: user.preferences || {},
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      // 🔹 On login
      if (user) {
        token.roleId = user.roleId;
        token.companyId = user.companyId;
        token.permissions = user.permissions;
        token.theme = user.theme;
        token.projects = user.projects ?? [];
        token.preferences = user.preferences || {};
        token.id = user.id;

        return token;
      }

      // 🔹 On refresh → rehydrate from users.json
      const users = await getUsers();
      const dbUser = users.find(
        (u) => u.email?.toLowerCase() === token.email?.toLowerCase(),
      );

      if (dbUser) {
        token.roleId = dbUser.roleId;
        token.companyId = dbUser.companyId;
        token.permissions = dbUser.permissions;
        token.theme = dbUser.theme ?? "system";
        token.projects = dbUser.projects ?? [];
        token.preferences = dbUser.preferences || {};
        token.id = dbUser.id;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.roleId = token.roleId;
        session.user.companyId = token.companyId;
        session.user.permissions = token.permissions;
        session.user.theme = token.theme;
        session.user.projects = token.projects;
        session.user.preferences = token.preferences || {};
        session.user.id = token.id;
      }
      return session;
    },
  },
};
