/** @format */
"use client";

import { FolderOpen, Home, LogIn, Search, User, Users } from "lucide-react";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function NotFound() {
  const pathname = usePathname();

  const context = (() => {
    if (pathname.startsWith("/dashboard")) {
      return {
        title: "Dashboard page not found",
        description: "The requested dashboard resource could not be found.",
        icon: Users,
        href: "/dashboard",
        label: "Dashboard",
      };
    }

    if (pathname.startsWith("/portal")) {
      return {
        title: "Portal page not found",
        description: "The requested portal resource could not be found.",
        icon: User,
        href: "/portal",
        label: "Portal",
      };
    }

    if (pathname.startsWith("/account")) {
      return {
        title: "Account page not found",
        description: "The requested account page could not be found.",
        icon: User,
        href: "/account",
        label: "Account",
      };
    }

    if (pathname.startsWith("/auth")) {
      return {
        title: "Authentication page not found",
        description: "The requested authentication page could not be found.",
        icon: LogIn,
        href: "/auth",
        label: "Sign In",
      };
    }

    return {
      title: "Page not found",
      description:
        "The page you are looking for does not exist or may have been moved.",
      icon: FolderOpen,
      href: "/",
      label: "Home",
    };
  })();

  const ContextIcon = context.icon;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full text-center"
      >
        {/* 404 */}
        <div className="relative mb-8">
          <motion.div
            className="absolute inset-0 blur-3xl opacity-20"
            style={{
              background: "var(--accent)",
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.15, 0.3, 0.15],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
            }}
          />

          <motion.h1
            className="relative text-8xl md:text-9xl font-bold tracking-tight"
            style={{
              color: "var(--accent)",
            }}
            animate={{
              y: [0, -3, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          >
            404
          </motion.h1>
        </div>

        {/* Content */}
        <div
          className="rounded-3xl p-8 "
          style={{
            background: "var(--foreground)",
          }}
        >
          <div className="flex justify-center mb-6">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
              }}
            >
              <ContextIcon size={28} />
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-3">{context.title}</h2>

          <p
            className="text-sm max-w-md mx-auto"
            style={{
              color: "var(--text-muted)",
            }}
          >
            The page you're looking for doesn't exist, has been moved, or is no
            longer available.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-white transition"
              style={{
                background: "var(--accent)",
              }}
            >
              <Home size={16} />
              Home
            </Link>

            <Link
              href={context.href}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl  transition"
              style={{
                background: "var(--accent)",
              }}
            >
              <ContextIcon />
              {context.label}
            </Link>
          </div>

          <div
            className="mt-6 text-xs"
            style={{
              color: "var(--text-muted)",
            }}
          >
            Error 404 • Resource unavailable
          </div>
        </div>
      </motion.div>
    </div>
  );
}
