export interface Stat {
  label: string;
  value: string;
  tone?: "default" | "danger";
}

/** Compact figures strip. Operational counts only — this is not a report. */
export function SummaryStats({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-line bg-surface px-2 py-1.5 shadow-card"
        >
          <dt className="truncate text-[10px] font-medium uppercase text-muted">
            {stat.label}
          </dt>
          <dd
            className={`text-sm font-semibold tabular-nums ${
              stat.tone === "danger" ? "text-danger" : "text-ink"
            }`}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
