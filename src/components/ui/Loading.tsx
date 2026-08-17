/** @format */
"use client";

type Props = {
  title?: string;
  description?: string;
};

export default function Loading({
  title = "Loading",
  description = "Please wait...",
}: Props) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-(--foreground) border border-(--border)/10 p-10 text-center shadow-sm">
        <div className="mb-8 flex justify-center">
          <div className="relative size-16">
            <div className="absolute inset-0 rounded-full border-4 border-(--border)/15" />

            <div
              className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-(--accent)"
              style={{
                animationDuration: "0.8s",
              }}
            />
          </div>
        </div>

        <h2 className="text-xl font-semibold">{title}</h2>

        <p className="mt-2 text-sm text-(--text-muted)">{description}</p>
      </div>
    </div>
  );
}
