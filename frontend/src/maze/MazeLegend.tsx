export function MazeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-lab-border bg-lab-surface/70 px-3 py-2 text-[11px] text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border border-emerald-500 bg-emerald-950 font-mono text-[9px] font-bold text-emerald-300">
          S
        </span>
        시작점
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border border-teal-400 bg-teal-950 font-mono text-[9px] font-bold text-teal-200">
          G
        </span>
        도착점
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-slate-300" />
        경계선 벽
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-sky-400" />
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-600 font-mono text-[9px] font-bold text-white">
          Q
        </span>
        Q-Learning 탈출 경로
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-violet-400" />
        미로 제작 AI 수정
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-400" />
        벽 이동(원래 위치)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 border-t-2 border-dashed border-rose-500" />
        되돌린 수정
      </span>
    </div>
  );
}
