/** @format */

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import { usePathname } from "next/navigation";

type SidebarContextType = {
  open: boolean;
  setOpen: any;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

const STORAGE_KEY = "sidebar-open";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    (async () => {
      if (window.innerWidth < 768) {
        setOpen(false);
      } else if (stored !== null) {
        setOpen(stored === "true");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (window.innerWidth < 768) {
        setOpen(false);
      }
    })();
  }, [pathname]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, String(open));
    }
  }, [open, mounted]);

  const toggle = () => setOpen((o) => !o);

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
