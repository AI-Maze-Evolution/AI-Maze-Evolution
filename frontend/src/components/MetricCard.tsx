interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "q" | "sarsa" | "merged" | "builder" | "neutral";
}

const ACCENT_BAR: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  q: "border-t-sky-400",
  sarsa: "border-t-amber-400",
  merged: "border-t-emerald-400",
  builder: "border-t-violet-400",
  neutral: "border-t-slate-600",
};

const ACCENT_VALUE: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  q: "text-sky-300",
  sarsa: "text-amber-300",
  merged: "text-emerald-300",
  builder: "text-violet-300",
  neutral: "text-slate-100",
};

export function MetricCard({
  label,
  value,
  sublabel,
  accent = "neutral",
}: MetricCardProps) {
  return (
    <div
      className={`border border-lab-border border-t-2 bg-lab-surface px-3 py-2 ${ACCENT_BAR[accent]}`}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${ACCENT_VALUE[accent]}`}>
        {value}
      </div>
      {sublabel && <div className="mt-0.5 text-[11px] text-slate-500">{sublabel}</div>}
    </div>
  );
}
