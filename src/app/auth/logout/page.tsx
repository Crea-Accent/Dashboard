/** @format */

"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/auth/login" });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <p className="text-sm text-zinc-500">Signing you out…</p>
    </div>
  );
}
