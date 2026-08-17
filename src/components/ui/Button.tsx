/** @format */
"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "primary-ghost"
  | "secondary"
  | "ghost"
  | "danger"
  | "danger-ghost";

type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  className = "",
  disabled,
  ...props
}: Props) {
  const variants: Record<ButtonVariant, string> = {
    primary: `
			bg-(--accent)
			text-white
			hover:bg-(--hover-accent)
			active:bg-(--active-accent)
		`,

    "primary-ghost": `
			bg-(--accent)/10
			border
			border-(--accent)
			text-(--accent)
			hover:bg-(--accent)/20
		`,

    secondary: `
			bg-(--foreground)
			border
			border-(--border)/15
			text-(--text)
			hover:border-(--accent)/40
			hover:bg-(--background)
		`,

    ghost: `
			text-(--text)
			hover:bg-(--foreground)
		`,

    danger: `
			bg-red-600
			text-white
			hover:bg-red-700
		`,

    "danger-ghost": `
			text-red-500
			hover:bg-red-500/10
		`,
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-xs rounded-xl",
    md: "h-10 px-4 text-sm rounded-2xl",
    lg: "h-12 px-5 text-base rounded-2xl",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`
				inline-flex items-center justify-center gap-2
				font-medium
				select-none
				transition-all duration-200
				active:scale-[0.98]
				disabled:pointer-events-none
				disabled:opacity-50

				${sizes[size]}
				${variants[variant]}
				${className}
			`}
      {...props}
    >
      {loading ? (
        <div className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        icon
      )}

      {children}
    </button>
  );
}
