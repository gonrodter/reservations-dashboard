import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl border border-line bg-sunken text-muted">
        {icon}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="max-w-60 text-xs leading-5 text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
