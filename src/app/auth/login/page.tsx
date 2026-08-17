/** @format */
"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { motion } from "framer-motion";
import { redirect } from "next/navigation";

export default function LoginPage() {
  const { status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      redirect("/dashboard");
    }
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password");
      return;
    }

    redirect("/dashboard");
  }

  return (
    <div
      className="
				min-h-screen
				flex items-center justify-center
				bg-gradient-to-br
				from-(--active-accent) via-white to-(--accent)
				dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900
				p-6
			"
    >
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="
					w-full max-w-sm
					bg-white dark:bg-zinc-900
					border border-zinc-200 dark:border-zinc-800
					shadow-xl
					rounded-2xl
					p-7
					space-y-5
				"
      >
        {/* Header */}

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Welcome back
          </h1>

          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to continue
          </p>
        </div>

        {/* Email */}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="
						w-full h-10 px-3
						rounded-lg
						border border-zinc-200 dark:border-zinc-800
						bg-white dark:bg-zinc-900
						text-sm
						focus:outline-none
						focus:ring-2 focus:ring-(--accent)/50
					"
        />

        {/* Password */}

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="
							w-full h-10 px-3 pr-10
							rounded-lg
							border border-zinc-200 dark:border-zinc-800
							bg-white dark:bg-zinc-900
							text-sm
							focus:outline-none
							focus:ring-2 focus:ring-(--accent)/50
						"
          />

          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="
							absolute right-2 top-1/2 -translate-y-1/2
							h-7 w-7
							flex items-center justify-center
							rounded-md
							text-zinc-400
							hover:text-(--hover-accent) dark:hover:text-(--hover-accent)
							hover:bg-zinc-100 dark:hover:bg-zinc-800
							transition
						"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Error */}

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        {/* Submit */}

        <button
          type="submit"
          disabled={loading}
          className="
						w-full h-10
						flex items-center justify-center gap-2
						rounded-lg
						bg-(--accent) text-white
						text-sm font-medium
						hover:bg-(--accent)
						active:scale-[0.98]
						transition
					"
        >
          <LogIn size={16} />
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </motion.form>
    </div>
  );
}
