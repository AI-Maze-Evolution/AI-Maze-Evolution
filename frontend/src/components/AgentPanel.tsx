import { Compass, Navigation, TrendingDown, TrendingUp, Zap } from "lucide-react";
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
  if (!path.length) return "아직 이동 경로 데이터가 없습니다.";
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
    <section className="instrument-card min-w-0 overflow-hidden rounded-md border-l-4 border-l-cyan-400 shadow-lg">
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between border-b border-[#1b273b] bg-gradient-to-l from-cyan-950/40 via-[#090e18] to-transparent px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-cyan-950 border border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
            <Navigation className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-mono text-xs font-black tracking-wide text-cyan-200">
                Q-LEARNING · 미로 탈출 AI
              </h2>
              <span className="rounded bg-cyan-950 px-1.5 py-0.2 font-mono text-[9px] font-black text-cyan-300 border border-cyan-700/70">
                방어 · 돌파
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              오프폴리시 TD(0) · 라운드당 {report?.n_episodes ?? 50}회 탈출로 개척
            </p>
          </div>
        </div>

        {deltaSuccess !== null && (
          <div
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${
              deltaSuccess >= 0
                ? "border-emerald-700/60 bg-emerald-950/60 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                : "border-rose-700/60 bg-rose-950/60 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
            }`}
            title="직전 라운드 대비 탈출 성공률 변동"
          >
            {deltaSuccess >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {deltaSuccess >= 0 ? "+" : ""}
              {(deltaSuccess * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3 p-3.5">
        {/* 현재 위치 / 행동 / 최적 경로 계측 셀 */}
        <div className="grid grid-cols-3 gap-2 rounded border border-[#1b283d] bg-[#090e18] p-2.5 font-mono text-xs tabular-nums">
          <div>
            <div className="text-[10px] font-medium text-slate-500">현재 좌표</div>
            <div className="mt-0.5 text-sm font-bold text-slate-100">
              {pos ? `(${pos[0]}, ${pos[1]})` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-500">선택 행동</div>
            <div className="mt-0.5 inline-flex items-center gap-1 font-bold text-sky-300">
              <Zap className="h-3 w-3" />
              <span>{action.label}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-500">최적 경로 길이</div>
            <div className="mt-0.5 text-sm font-bold text-slate-200">
              {path.length ? `${Math.max(0, path.length - 1)}보` : "—"}
            </div>
          </div>
        </div>

        {/* 탈출 성공률 & 초기 적응률 듀얼 인디케이터 */}
        <div className="grid grid-cols-2 gap-2.5 rounded border border-[#182438] bg-[#090e18] p-2.5 font-mono text-xs tabular-nums">
          <div>
            <div className="flex justify-between text-[10.5px]">
              <span className="text-slate-400">탈출 성공률</span>
              <span className="font-bold text-sky-300">
                {report ? `${successPct.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#121c2c]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, successPct))}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10.5px]">
              <span className="text-slate-400">미로 적응률</span>
              <span className="font-bold text-emerald-300">
                {report ? `${earlyPct.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#121c2c]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, earlyPct))}%` }}
              />
            </div>
          </div>
        </div>

        {/* 에이전트 정책 상태 요약 셀 */}
        <div className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
          <div className="rounded border border-[#1a263a] bg-[#0a101b] p-2">
            <span className="block text-[10px] text-slate-500">실시간 스텝 진행</span>
            <span className="mt-0.5 block text-xs font-bold text-sky-300">
              {path.length ? `${clampedIdx} / ${Math.max(0, path.length - 1)}보` : "—"}
            </span>
          </div>
          <div className="rounded border border-[#1a263a] bg-[#0a101b] p-2">
            <span className="block text-[10px] text-slate-500">탐색 에피소드</span>
            <span className="mt-0.5 block text-xs font-bold text-slate-200">
              {report ? `${report.n_episodes}회/라운드` : "50회"}
            </span>
          </div>
          <div className="rounded border border-[#1a263a] bg-[#0a101b] p-2">
            <span className="block text-[10px] text-slate-500">경로 최적화</span>
            <span className="mt-0.5 block text-xs font-bold text-emerald-300">
              {report && report.shortest_path_len !== null && path.length > 0
                ? `${((path.length - 1) / Math.max(1, report.shortest_path_len)).toFixed(1)}× 최단`
                : "—"}
            </span>
          </div>
        </div>

        {/* 현재 이동 궤적 슬라이스 프리뷰 */}
        <div className="border-t border-[#182438] pt-2">
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <Compass className="h-3 w-3 text-sky-400" />
              실시간 이동 궤적 스트림
            </span>
            <span className="tabular-nums text-slate-500">
              {lastResult ? `라운드 ${lastResult.round}` : "대기 중"}
            </span>
          </div>
          <div className="mt-1 truncate rounded border border-[#1a263a] bg-[#090e18] px-2.5 py-1 font-mono text-[11px] text-slate-300 tabular-nums">
            {formatPathPreview(path, stepIndex)}
          </div>
        </div>
      </div>
    </section>
  );
}
