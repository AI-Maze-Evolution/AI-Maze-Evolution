export function MazeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-lab-border bg-lab-surface/70 px-3 py-2 text-[11px] text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border border-emerald-500 bg-emerald-950 font-mono text-[9px] font-bold text-emerald-300">
          S
        </span>
        Start
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border border-teal-400 bg-teal-950 font-mono text-[9px] font-bold text-teal-200">
          G
        </span>
        Goal
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[2px] border border-slate-500/70 bg-[#26354d]" />
        Wall
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-sky-400" />
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-600 font-mono text-[9px] font-bold text-white">
          Q
        </span>
        Q-Learning Solver Path
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[2px] border-2 border-violet-400" />
        Builder Edit (SARSA/Rule)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[2px] border-2 border-dashed border-rose-500" />
        Reverted Edit
      </span>
    </div>
  );
}
