export function MazeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#1a273c] bg-[#080d17] px-4 py-2 font-mono text-[11px] text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-emerald-400 bg-emerald-950/80 text-[10px] font-extrabold text-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.4)]">
          S
        </span>
        <span className="text-slate-300 font-medium">출발지(Start)</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-teal-400 bg-teal-950/80 text-[10px] font-extrabold text-teal-200 shadow-[0_0_6px_rgba(45,212,191,0.4)]">
          G
        </span>
        <span className="text-slate-300 font-medium">도착지(Goal)</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-4 rounded-full bg-slate-300 shadow-[0_0_4px_rgba(203,213,225,0.4)]" />
        <span className="text-slate-300">경계선 벽</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-sky-400" />
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[10px] font-extrabold text-white shadow-[0_0_8px_rgba(56,189,248,0.6)]">
          Q
        </span>
        <span className="text-sky-300 font-medium">Q-Learning 경로</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-4 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.6)]" />
        <span className="text-violet-300 font-medium">제작 AI 신규 벽</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-400" />
        <span className="text-amber-300">벽 이동(이전 위치)</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 border-t-2 border-dashed border-rose-500" />
        <span className="text-rose-400">되돌린 수정</span>
      </span>
    </div>
  );
}
