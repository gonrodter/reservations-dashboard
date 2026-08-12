import type { Metadata } from "next";
import { LogoMark } from "@/components/icons";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = {
  title: "Create password · Reservations",
};

export default function SetPasswordPage() {
  return (
    <main className="canvas-decor flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-frame">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-ink text-surface">
            <LogoMark size={19} />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Create your password</h1>
            <p className="text-xs text-muted">Restaurant owner account</p>
          </div>
        </div>

        <p className="mt-5 text-xs leading-5 text-muted">
          Choose the password you will use to access your restaurant dashboard.
        </p>

        <div className="mt-4">
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
