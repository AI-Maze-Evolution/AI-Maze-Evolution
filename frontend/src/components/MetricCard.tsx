interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "q" | "sarsa" | "merged" | "builder" | "neutral";
}

const ACCENT_BAR: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  q: "from-sky-400 to-sky-600 shadow-[0_0_12px_rgba(56,189,248,0.4)]",
  sarsa: "from-amber-400 to-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.4)]",
  merged: "from-emerald-400 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.4)]",
  builder: "from-violet-400 to-violet-600 shadow-[0_0_12px_rgba(167,139,250,0.4)]",
  neutral: "from-slate-500 to-slate-700 shadow-none",
};

const ACCENT_VALUE: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  q: "text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.35)]",
  sarsa: "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]",
  merged: "text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.35)]",
  builder: "text-violet-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.35)]",
  neutral: "text-slate-100",
};

export function MetricCard({
  label,
  value,
  sublabel,
  accent = "neutral",
}: MetricCardProps) {
  return (
    <div className="instrument-card group relative flex flex-col justify-between overflow-hidden rounded-md p-3">
      {/* 상단 액센트 레이저 라인 */}
      <div
        className={`absolute left-0 top-0 h-[2.5px] w-full bg-gradient-to-r ${ACCENT_BAR[accent]}`}
      />

      <div>
        <div className="flex items-center justify-between font-mono text-[11px] font-medium tracking-wide text-slate-400">
          <span>{label}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-slate-700 transition-colors group-hover:bg-slate-400" />
        </div>

        <div
          className={`mt-1 truncate font-mono text-xl font-extrabold tracking-tight tabular-nums ${ACCENT_VALUE[accent]}`}
        >
          {value}
        </div>
      </div>

      {sublabel && (
        <div className="mt-1.5 truncate border-t border-[#172236] pt-1.5 text-[11px] text-slate-400">
          {sublabel}
        </div>
      )}
    </div>
  );
}
