"use client";

import { AlertIcon } from "@/components/icons";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <AlertIcon size={18} />
      </div>
      <p className="text-sm font-semibold">Could not load reservations</p>
      <p className="max-w-64 text-xs leading-5 text-muted">
        Something went wrong while loading this view. Check your connection and
        try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-ink px-4 py-2 text-[13px] font-medium text-surface hover:opacity-85"
      >
        Try again
      </button>
    </div>
  );
}
