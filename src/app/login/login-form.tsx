"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";
import { AlertIcon, Spinner } from "@/components/icons";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-soft">
          Correo electrónico
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@restaurante.com"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-ink"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-soft">
          Contraseña
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-ink"
        />
      </label>

      {state?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          <AlertIcon size={13} /> {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending && <Spinner size={14} />}
        Iniciar sesión
      </button>
    </form>
  );
}
