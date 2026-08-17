/** @format */
"use client";

import { createContext, useContext, useEffect, useState } from "react";

import tinycolor from "tinycolor2";
import { useSession } from "next-auth/react";

type Theme = "light" | "dark" | "system";

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  setAccent: (color: string) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
    return;
  }

  if (theme === "light") {
    root.classList.remove("dark");
    return;
  }

  // system
  const prefersDark = getSystemTheme();
  root.classList.toggle("dark", prefersDark === "dark");
}

function applyAccent(color?: string) {
  const accent = tinycolor(color || "#a4b795");

  document.documentElement.style.setProperty("--accent", accent.toHexString());

  document.documentElement.style.setProperty(
    "--hover-accent",
    accent.clone().darken(8).toHexString(),
  );

  document.documentElement.style.setProperty(
    "--active-accent",
    accent.clone().setAlpha(0.15).toRgbString(),
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";

    const stored = localStorage.getItem("theme") as Theme | null;

    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }

    return session?.user?.theme ?? "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  /* ---------- APPLY THEME ---------- */

  useEffect(() => {
    (() => {
      const resolved = theme === "system" ? getSystemTheme() : theme;

      setResolvedTheme(resolved);
      applyTheme(theme);
    })();
  }, [theme]);

  /* ---------- SYNC SESSION THEME ---------- */

  useEffect(() => {
    (() => {
      if (!session?.user?.theme) return;

      if (session?.user?.theme !== theme) {
        localStorage.setItem("theme", session?.user?.theme);
        setTheme(session?.user?.theme);
      }
    })();
  }, [session?.user?.theme]);

  /* ---------- USER CHANGE ---------- */

  async function updateTheme(next: Theme) {
    localStorage.setItem("theme", next);
    setTheme(next);

    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
  }

  /* ---------- SYSTEM LISTENER ---------- */

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = () => {
      if (theme !== "system") return;

      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };

    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    if (!session?.user?.companyId) return;

    (async () => {
      try {
        const res = await fetch("/api/settings/companies");

        const data = await res.json();

        const company = data.companies?.find(
          (c: any) => c.id === session.user.companyId,
        );

        if (!company) return;

        applyAccent(
          session.user.preferences?.debugMode ? "#8b7cf6" : company.color,
        );
      } catch (err) {
        console.error(err);
      }
    })();
  }, [session?.user?.companyId]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme: updateTheme,
        setAccent: applyAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
