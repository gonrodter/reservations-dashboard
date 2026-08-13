import type { BookingStatus } from "@/lib/types";

const STYLES: Record<BookingStatus, { label: string; className: string }> = {
  confirmed: { label: "Confirmada", className: "bg-ok-soft text-ok" },
  pending: { label: "Pendiente", className: "bg-warn-soft text-warn" },
  seated: { label: "En mesa", className: "bg-info-soft text-info" },
  completed: { label: "Completada", className: "bg-sunken text-muted" },
  cancelled: { label: "Cancelada", className: "bg-danger-soft text-danger" },
  no_show: { label: "No se presentó", className: "bg-danger-soft text-danger" },
  unknown: { label: "—", className: "bg-sunken text-muted" },
};

/** The same wording, for places that print the status as plain text. */
export function statusLabel(status: BookingStatus): string {
  return (STYLES[status] ?? STYLES.unknown).label;
}

export function StatusChip({ status }: { status: BookingStatus }) {
  const style = STYLES[status] ?? STYLES.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ${style.className}`}
    >
      <span className="size-1 rounded-full bg-current" aria-hidden />
      {style.label}
    </span>
  );
}
