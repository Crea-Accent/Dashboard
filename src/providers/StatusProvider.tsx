/** @format */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { Session } from "next-auth";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

type User = Omit<Session["user"], "passwordHash"> & {
  company?: {
    id: string;
    name: string;
    color: string;
  };

  presence: {
    status: "online" | "idle" | "offline";
    lastSeen: string | null;
    lastSeenAgo: number | null;
    page?: string;
    project?: string;
    idle: boolean;
  };
};

type StatusContextType = {
  users: User[];
  refresh: () => Promise<void>;
};

const StatusContext = createContext<StatusContextType | null>(null);

const HEARTBEAT_INTERVAL = 30000;
const IDLE_TIMEOUT = 5 * 60 * 1000;

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const [users, setUsers] = useState<User[]>([]);

  const lastActivity = useRef(Date.now());

  const refresh = useCallback(async () => {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/settings/companies"),
      ]);

      const usersData = await usersRes.json();
      const companiesData = await companiesRes.json();

      const companies = new Map(
        (companiesData.companies ?? []).map((c: any) => [c.id, c]),
      );

      const enriched = (usersData.users ?? [])
        .filter((u: User) => u.id !== session?.user.id)
        .map((u: User) => ({
          ...u,
          company: companies.get(u.companyId),
        }));

      setUsers(enriched);
    } catch (err) {
      console.error(err);
    }
  }, [session?.user.id]);

  useEffect(() => {
    const updateActivity = () => {
      lastActivity.current = Date.now();
    };

    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("mousedown", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("touchstart", updateActivity);
    window.addEventListener("scroll", updateActivity);

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("mousedown", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
      window.removeEventListener("scroll", updateActivity);
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;

    const heartbeat = async () => {
      try {
        await fetch(`/api/users/${session.user.id}/presence`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page: pathname,
            idle: Date.now() - lastActivity.current > IDLE_TIMEOUT,
          }),
        });

        await refresh();
      } catch (error) {
        console.error(error);
      }
    };

    heartbeat();

    const interval = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;

    (async () => {
      await fetch(`/api/users/${session.user.id}/presence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: pathname,
          idle: Date.now() - lastActivity.current > IDLE_TIMEOUT,
        }),
      });

      refresh();
    })();
  }, [pathname, session?.user.id]);

  useEffect(() => {
    const onFocus = () => refresh();

    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!document.hidden) {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handler);

    return () => {
      document.removeEventListener("visibilitychange", handler);
    };
  }, []);

  return (
    <StatusContext.Provider
      value={{
        users,
        refresh,
      }}
    >
      {children}
    </StatusContext.Provider>
  );
}

export function useStatus() {
  const ctx = useContext(StatusContext);

  if (!ctx) {
    throw new Error("Status must be used inside StatusProvider");
  }

  return ctx;
}
