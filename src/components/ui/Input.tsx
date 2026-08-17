/** @format */
"use client";

import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  icon?: ReactNode;
};

const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, icon, className = "", ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-(--text)">{label}</label>
        )}

        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--text-muted) pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            {...props}
            className={`
							w-full
							h-11
							${icon ? "pl-11" : "px-4"}
							${icon ? "pr-4" : ""}
							rounded-2xl
							bg-(--foreground)
							border
							text-sm
							text-(--text)
							placeholder:text-(--text-muted)
							outline-none
							transition-all

							${error ? `border-red-500 focus:border-red-500` : `border-(--border)/15 focus:border-(--accent)`}

							${className}
						`}
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
