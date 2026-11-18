import {
  deriveActionFromPath,
  type Coord,
  type HistoryItem,
  type RoundResult,
} from "../types/simulation";

interface AgentPanelProps {
  lastResult: RoundResult | null;
  history: HistoryItem[];
  stepIndex: number;
}

function formatPathPreview(path: Coord[], currentIdx: number): string {
  if (!path.length) return "아직 이동 경로가 없습니다.";
  const clamped = Math.min(currentIdx, path.length - 1);
  const start = Math.max(0, clamped - 3);
  const slice = path.slice(start, start + 7);
  const formatted = slice.map(([r, c]) => `(${r},${c})`).join(" → ");
  return `${start > 0 ? "… " : ""}${formatted}${start + 7 < path.length ? " …" : ""}`;
}

export function AgentPanel({ lastResult, history, stepIndex }: AgentPanelProps) {
  const report = lastResult?.reports.q ?? null;
  const path = lastResult?.best_paths.q ?? [];
  const goal: Coord = lastResult?.goal ?? [4, 4];
  const prevHistory = history.length >= 2 ? history[history.length - 2] : null;
  const deltaSuccess =
    report && prevHistory ? report.success_rate - prevHistory.success_rate : null;

  const clampedIdx = path.length ? Math.min(stepIndex, path.length - 1) : 0;
  const pos = path.length ? path[clampedIdx] : null;
  const action = deriveActionFromPath(path, stepIndex, goal);

  const successPct = (report?.success_rate ?? 0) * 100;
  const earlyPct = (report?.early_success_rate ?? 0) * 100;

  return (
    <section className="border border-lab-border border-l-2 border-l-sky-400 bg-lab-surface">
      <div className="flex items-center justify-between border-b border-lab-border px-3 py-2">
        <div>
          <h2 className="font-mono text-xs font-semibold text-sky-300">
            탈출 AI · Q-Learning
          </h2>
          <p className="text-[11px] text-slate-500">
            오프폴리시 TD(0) · 라운드당 {report?.n_episodes ?? 50}회 에피소드 · 최적 경로 재생
          </p>
        </div>
        {deltaSuccess !== null && (
          <span
            className={`font-mono text-xs font-semibold tabular-nums ${
              deltaSuccess >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
            title="직전 라운드 대비 탈출 성공률 변화"
          >
            {deltaSuccess >= 0 ? "+" : ""}
            {(deltaSuccess * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="space-y-3 p-3">
        {/* 현재 위치, 행동, 경로 길이 */}
        <div className="grid grid-cols-3 gap-2 border border-lab-border bg-lab-bg p-2 font-mono text-[11px] tabular-nums">
          <div>
            <div className="text-[10px] text-slate-500">현재 위치</div>
            <div className="font-semibold text-slate-100">
              {pos ? `(${pos[0]}, ${pos[1]})` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">선택 행동</div>
            <div className="font-semibold text-sky-300">{action.label}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">최적 경로 길이</div>
            <div className="font-semibold text-slate-200">
              {path.length ? `${Math.max(0, path.length - 1)}회` : "—"}
            </div>
          </div>
        </div>

        {/* 탈출 성공률 & 초기 적응률 */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <div className="flex justify-between font-mono text-[11px] tabular-nums">
              <span className="text-slate-400">탈출 성공률</span>
              <span className="font-semibold text-slate-100">
                {report ? `${successPct.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-slate-800">
              <div
                className="h-full bg-sky-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, successPct))}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-mono text-[11px] tabular-nums">
              <span className="text-slate-400">초기 적응률</span>
              <span className="text-slate-200">
                {report ? `${earlyPct.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-slate-800">
              <div
                className="h-full bg-sky-400/70 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, earlyPct))}%` }}
              />
            </div>
          </div>
        </div>

        {/* 평균 보상, 평균 이동 횟수, BFS 최단 거리 */}
        <div className="grid grid-cols-3 gap-2 border-t border-lab-border pt-2 font-mono text-[11px] tabular-nums">
          <div>
            <span className="block text-[10px] text-slate-500">평균 보상</span>
            <span className="font-semibold text-slate-100">
              {report ? report.avg_reward.toFixed(1) : "—"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500">평균 이동 횟수</span>
            <span className="font-semibold text-slate-100">
              {report ? `${report.avg_steps.toFixed(1)}회` : "—"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500">BFS 최단 거리</span>
            <span className="font-semibold text-emerald-300">
              {report && report.shortest_path_len !== null ? `${report.shortest_path_len}칸` : "—"}
            </span>
          </div>
        </div>

        {/* 현재 이동 경로 프리뷰 */}
        <div className="border-t border-lab-border pt-2">
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>현재 이동 경로</span>
            <span className="tabular-nums">
              {lastResult ? `라운드 ${lastResult.round}` : "대기 중"}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400 tabular-nums">
            {formatPathPreview(path, stepIndex)}
          </div>
        </div>
      </div>
    </section>
  );
}
