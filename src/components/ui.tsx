"use client";

import { useEffect, type ReactNode } from "react";
import { AlertIcon, Spinner, XIcon } from "@/components/icons";

// Shared primitives carrying the dashboard's existing look: 13px controls,
// rounded-lg borders on --color-line, ink-filled primary actions.

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none transition-colors placeholder:text-muted focus:border-ink disabled:bg-sunken disabled:text-muted";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-surface hover:opacity-85",
  secondary: "border border-line bg-surface hover:bg-sunken",
  danger: "border border-danger/30 bg-danger-soft text-danger hover:border-danger/60",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
};

export function Button({
  variant = "secondary",
  pending,
  icon,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  pending?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-opacity disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {pending ? <Spinner size={13} /> : icon}
      {children}
    </button>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-4 text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`${inputClass} resize-none ${props.className ?? ""}`} />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-[13px]"
    >
      <span
        className={`relative h-4.5 w-8 shrink-0 rounded-full transition-colors ${
          checked ? "bg-ok" : "bg-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 size-3.5 rounded-full bg-surface shadow-card transition-all ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </span>
      <span className="font-medium text-ink-soft">{label}</span>
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

/** Page-level heading used by every configuration section. */
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 max-w-prose text-xs leading-5 text-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
      <AlertIcon size={13} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 gap-0.5 rounded-lg bg-sunken p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-surface text-ink shadow-card"
              : "text-muted hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred panel from tablet up. */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/20"
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-float md:rounded-2xl">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
          >
            <XIcon size={15} />
          </button>
        </header>
        {children}
        {footer && (
          <footer className="flex gap-2 border-t border-line p-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/20"
      />
      <div className="relative w-full max-w-xs rounded-2xl bg-surface p-4 shadow-float">
        <div
          className={`mx-auto flex size-9 items-center justify-center rounded-full ${
            destructive ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"
          }`}
        >
          <AlertIcon size={17} />
        </div>
        <h2 className="mt-2 text-center text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-center text-xs leading-5 text-muted">{body}</p>

        {error && <div className="mt-3">{<ErrorNote>{error}</ErrorNote>}</div>}

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 py-2"
          >
            Keep it
          </Button>
          <Button
            type="button"
            variant={destructive ? "primary" : "primary"}
            onClick={onConfirm}
            pending={pending}
            className={`flex-1 py-2 ${destructive ? "bg-danger" : ""}`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
