"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AlertIcon, CheckIcon, Spinner } from "@/components/icons";

type Status = "checking" | "ready" | "saving" | "done" | "invalid";

export function SetPasswordForm() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const callbackError =
      hash.get("error_description") ??
      hash.get("error_code") ??
      hash.get("error") ??
      query.get("error");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    // Admin invitations use Supabase's implicit flow, while the SSR browser
    // client uses PKCE. Remove the fragment before creating that client, then
    // explicitly transfer the invite session into its cookie-backed storage.
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }

    if (callbackError) {
      queueMicrotask(() => {
        if (!active) return;
        setError(
          "This invitation is invalid or has expired. Ask the administrator to send a new one."
        );
        setStatus("invalid");
      });
      return () => {
        active = false;
      };
    }

    const supabase = createClient();
    const session =
      accessToken && refreshToken
        ? supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        : supabase.auth.getSession();

    void session.then(({ data, error: sessionError }) => {
      if (!active) return;
      if (!sessionError && data.session) setStatus("ready");
      else {
        setError(
          "This invitation is invalid or has expired. Ask the administrator to send a new one."
        );
        setStatus("invalid");
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(
        updateError.code === "weak_password"
          ? "Choose a stronger password."
          : "Could not save your password. Request a new invitation and try again."
      );
      setStatus("ready");
      return;
    }

    setStatus("done");
    window.setTimeout(() => window.location.replace("/"), 700);
  }

  if (status === "checking") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <Spinner size={14} /> Checking invitation…
      </p>
    );
  }

  if (status === "done") {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-ok-soft px-3 py-2 text-xs font-medium text-ok">
        <CheckIcon size={14} /> Password created. Opening your dashboard…
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <div>
        <p className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          <AlertIcon size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex text-xs font-medium text-ink-soft hover:text-ink"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-soft">Password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-ink"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-soft">
          Confirm password
        </span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-ink"
        />
      </label>

      {error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          <AlertIcon size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {status === "saving" && <Spinner size={14} />}
        Create password
      </button>
    </form>
  );
}
