/** @format */
"use client";

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  color?: string;
  dot?: boolean;
};

import { getContrastYIQ } from "@/lib/color";

export default function Badge({
  children,
  color = "var(--accent)",
  dot = false,
}: Props) {
  const textColor = color.startsWith("#") ? getContrastYIQ(color) : "white";

  return (
    <span
      className="
				inline-flex items-center gap-2
				h-7
				px-3
				rounded-full
				text-xs
				font-medium
				select-none
				whitespace-nowrap
				shadow-sm
				transition-colors
			"
      style={{
        backgroundColor: color,
        color: textColor,
      }}
    >
      {dot && (
        <span
          className="size-2 rounded-full shrink-0"
          style={{
            backgroundColor:
              textColor === "white"
                ? "rgba(255, 255, 255, 0.9)"
                : "rgba(0, 0, 0, 0.6)",
          }}
        />
      )}

      {children}
    </span>
  );
}
