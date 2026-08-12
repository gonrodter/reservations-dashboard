"use client";

import { AlertIcon } from "@/components/icons";

/**
 * Catches anything thrown above a page's own boundary — the dashboard and
 * admin layouts included — so a failed session read shows a way out instead of
 * the browser's bare 500 page.
 */
export default function AppError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="canvas-decor flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-frame">
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <AlertIcon size={18} />
        </div>
        <h1 className="mt-3 text-sm font-semibold">No se pudo cargar el panel</h1>
        <p className="mt-1 text-xs leading-5 text-muted">
          Se produjo un error al preparar tu sesión. Inténtalo de nuevo; si
          continúa, vuelve a iniciar sesión.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 w-full rounded-lg bg-ink py-2 text-[13px] font-medium text-surface transition-opacity hover:opacity-85 active:opacity-70"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
