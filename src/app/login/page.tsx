import type { Metadata } from "next";
import { LogoMark } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Reservations",
};

export default function LoginPage() {
  return (
    <main className="canvas-decor flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-frame">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-ink text-surface">
            <LogoMark size={19} />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Reservations</h1>
            <p className="text-xs text-muted">Staff dashboard</p>
          </div>
        </div>

        <p className="mt-5 text-xs leading-5 text-muted">
          Sign in with the account your restaurant gave you. Accounts are
          created by your administrator.
        </p>

        <div className="mt-4">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
