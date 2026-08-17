/** @format */

"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";

import Button from "./ui/Button";
import { HEADER_HEIGHT } from "@/lib/layout";
import Icon from "@/../public/favicon.svg";
import Link from "next/link";
import { useSidebar } from "../providers/SidebarProvider";

export default function Header() {
  const { toggle, open } = useSidebar();

  return (
    <header
      className="fixed w-full top-0 z-40 backdrop-blur-xl transition-all duration-300"
      style={{
        height: HEADER_HEIGHT,
        background: "color-mix(in srgb, var(--background) 80%, transparent)",
      }}
    >
      <div className="flex items-center h-full px-4 md:px-6 relative">
        {/* Sidebar Toggle */}
        <Button
          variant="ghost"
          onClick={toggle}
          className="z-10000"
          icon={
            open ? (
              <PanelLeftClose size={24} strokeWidth={1.8} />
            ) : (
              <PanelLeft size={24} strokeWidth={1.8} />
            )
          }
          style={{
            color: "var(--text)",
          }}
        />

        {/* Logo */}
        <Link
          href="/"
          className="absolute inset-0 flex items-center justify-center md:relative md:inset-auto md:justify-start md:ml-4 transition-all duration-300	hover:opacity-90"
        >
          <div
            className="transition-all duration-500"
            style={{
              filter:
                "drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 20%, transparent))",
            }}
          >
            <Icon className="h-9 w-auto" />
          </div>
        </Link>

        {/* Spacer for desktop alignment */}
        <div className="hidden md:block flex-1" />

        <div
          id="header-user-list"
          className="ml-auto md:ml-0 z-10000 relative"
        />
      </div>

      <div
        className="absolute bottom-0 left-0 h-px w-full pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 40%, transparent), transparent)",
        }}
      />
    </header>
  );
}
