/** @format */
"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";

import Button from "@/components/ui/Button";
import { motion } from "framer-motion";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html className="min-h-screen dark overflow-hidden">
      <body>
        <div className="flex min-h-screen items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="max-w-2xl w-full text-center"
          >
            {/* Glow + Icon */}

            <div className="relative flex justify-center mb-8">
              <motion.div
                className="absolute inset-0 blur-3xl opacity-20"
                style={{
                  background: "var(--accent)",
                }}
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.15, 0.3, 0.15],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute inset-0 blur-3xl opacity-20"
                  style={{
                    background: "var(--accent)",
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.15, 0.35, 0.15],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <motion.div
                  className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
                  animate={{
                    y: [0, -3, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <AlertTriangle
                    size={75}
                    style={{
                      color: "var(--accent)",
                    }}
                  />
                </motion.div>
              </div>
            </div>

            {/* Content Card */}

            <div
              className="rounded-3xl p-8"
              style={{
                background: "var(--foreground)",
              }}
            >
              <h1 className="text-4xl font-bold tracking-tight">
                Something exploded
              </h1>

              <p
                className="mt-3 max-w-lg mx-auto"
                style={{
                  color: "var(--text-muted)",
                }}
              >
                The application encountered an unexpected error. A rare event,
                much like users reading error messages before clicking buttons
                repeatedly.
              </p>

              {/* Error Details */}

              <div
                className="
									mt-8
									w-full
									rounded-2xl
									p-4
									text-left
									font-mono
									text-xs
									overflow-auto
									max-h-64
								"
                style={{
                  background: "var(--background)",
                }}
              >
                {error.message || "Unknown error"}
              </div>

              {process.env.NODE_ENV === "development" && (
                <div
                  className="
									mt-8
									w-full
									rounded-2xl
									p-4
									text-left
									font-mono
									text-xs
									overflow-auto
									max-h-64
								"
                  style={{
                    background: "var(--background)",
                  }}
                >
                  {error.stack}
                </div>
              )}

              {/* Actions */}

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button onClick={() => reset()} icon={<RefreshCw size={16} />}>
                  Retry
                </Button>

                <Button
                  icon={<Home size={16} />}
                  onClick={() => {
                    window.location.href = "/";
                  }}
                >
                  Home
                </Button>
              </div>

              {/* Footer */}

              <div
                className="mt-6 text-xs"
                style={{
                  color: "var(--text-muted)",
                }}
              >
                Unexpected Application Error
              </div>
            </div>
          </motion.div>
        </div>
      </body>
    </html>
  );
}
