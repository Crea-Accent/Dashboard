/** @format */
"use client";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;

  label?: string;
  description?: string;

  disabled?: boolean;
  className?: string;
};

export default function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = "",
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
				flex w-full items-center justify-between gap-4
				transition-opacity
				${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
				${className}
			`}
    >
      <div className="flex flex-1 flex-col text-left">
        {label && <span className="font-medium text-(--text)">{label}</span>}

        {description && (
          <span className="mt-1 text-sm text-(--text-muted)">
            {description}
          </span>
        )}
      </div>

      <div
        className={`
					relative h-7 w-12 shrink-0 rounded-full
					transition-colors duration-200
					${checked ? "bg-(--accent)" : "bg-(--border)/20"}
				`}
      >
        <div
          className={`
						absolute top-0.5 left-0.5
						size-6 rounded-full
						bg-white shadow
						transition-transform duration-200
						${checked ? "translate-x-5" : ""}
					`}
        />
      </div>
    </button>
  );
}
