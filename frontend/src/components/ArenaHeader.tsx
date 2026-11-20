import { Brain, Navigation, Swords } from "lucide-react";
import { formatEditTarget } from "../maze/wallUtils";
import { getBuilderActionLabel } from "../types/simulation";
import type { RoundResult, SimulationStatus } from "../types/simulation";

interface ArenaHeaderProps {
  lastResult: RoundResult | null;
  status: SimulationStatus;
  era: number;
  round: number;
  size: number;
  wallCount: number;
}

export function ArenaHeader({
  lastResult,
  status,
  era,
  round,
  size,
  wallCount,
}: ArenaHeaderProps) {
  const qReport = lastResult?.reports.q ?? null;
  const qPath = lastResult?.best_paths.q ?? [];
  const successPct = qReport ? qReport.success_rate * 100 : null;

  const builderActionLabel = getBuilderActionLabel(lastResult?.builder_action_name);
  const builderActionSummary = (() => {
    if (!lastResult) return "전투 대기 중";
    if (!lastResult.edit) {
      return lastResult.builder_action_name
        ? "경로 보호 (수정 건너뜀)"
        : "초기 배치 유지";
    }
    return formatEditTarget(lastResult.edit);
  })();

  const solverStatusSummary = (() => {
    if (!qReport || qPath.length === 0) return "경로 탐색 대기 중";
    return `${Math.max(0, qPath.length - 1)}보 최적 경로 돌파`;
  })();

  const battleStateBadge = (() => {
    if (!lastResult) {
      return {
        label: status === "running" ? "전투 연산 중" : "대결 대기",
        color: "border-slate-700 bg-slate-900/60 text-slate-300",
      };
    }
    if (successPct === null) {
      return {
        label: "대결 진행 중",
        color: "border-sky-700 bg-sky-950/60 text-sky-300",
      };
    }
    if (successPct >= 75) {
      return {
        label: "탈출 AI 우세 (돌파 성공)",
        color: "border-cyan-500/70 bg-cyan-950/70 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.35)]",
      };
    }
    if (successPct <= 35) {
      return {
        label: "제작 AI 우세 (탈출 저지)",
        color: "border-violet-500/70 bg-violet-950/70 text-violet-200 shadow-[0_0_12px_rgba(168,85,247,0.35)]",
      };
    }
    return {
      label: "공진화 균형 유지 (30~70%)",
      color: "border-emerald-500/70 bg-emerald-950/70 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]",
    };
  })();

  return (
    <section
      aria-label="AI 대결 상태 브로드캐스트"
      className="relative overflow-hidden rounded-lg border border-[#1b283d] bg-[#070c16]/95 p-3 shadow-xl backdrop-blur-md"
    >
      {/* 배경 전투 네온 글레어 효과 */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cyan-600/10 blur-3xl" />

      <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-12">
        {/* 좌측: SARSA BUILDER (공격 / 디스럽터) */}
        <div className="flex items-center justify-between rounded-md border border-violet-900/50 bg-gradient-to-r from-violet-950/50 via-[#100d20]/60 to-transparent p-2.5 transition-all hover:border-violet-500/60 lg:col-span-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-violet-500/60 bg-violet-950/90 shadow-[0_0_12px_rgba(168,85,247,0.35)]">
              <Brain className="h-4.5 w-4.5 text-violet-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-black tracking-wider text-violet-300">
                  SARSA
                </span>
                <span className="rounded bg-violet-950/80 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-violet-400 border border-violet-800/60">
                  미로 제작 · 공격
                </span>
              </div>
              <div className="truncate font-mono text-xs font-bold text-slate-100">
                {builderActionLabel}
              </div>
              <div className="truncate text-[10px] text-slate-400">
                {builderActionSummary}
              </div>
            </div>
          </div>

          <div className="text-right font-mono tabular-nums">
            <span className="block text-[9.5px] font-medium text-slate-500">제작 보상</span>
            <span
              className={`text-sm font-black ${
                (lastResult?.builder_reward ?? 0) >= 0 ? "text-emerald-300" : "text-rose-400"
              }`}
            >
              {lastResult ? (lastResult.builder_reward >= 0 ? `+${lastResult.builder_reward.toFixed(2)}` : lastResult.builder_reward.toFixed(2)) : "—"}
            </span>
          </div>
        </div>

        {/* 중앙: 대결 아레나 라운드 뱃지 (VS) */}
        <div className="flex flex-col items-center justify-center text-center lg:col-span-4">
          <div className="flex items-center gap-2 font-mono">
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-violet-500/60" />
            <div className="flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-[#0c1424] px-3 py-0.5 text-xs font-extrabold text-slate-200 shadow-md">
              <Swords className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span>ROUND {round}</span>
              <span className="text-slate-500">·</span>
              <span className="text-sky-300">ERA {era}</span>
            </div>
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-cyan-500/60" />
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-bold tracking-tight ${battleStateBadge.color}`}
            >
              {battleStateBadge.label}
            </span>
            <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">
              {size}×{size} 격자 · 경계선 벽 {wallCount}개
            </span>
          </div>
        </div>

        {/* 우측: Q-LEARNING SOLVER (방어 / 탈출 도전자) */}
        <div className="flex items-center justify-between rounded-md border border-cyan-900/50 bg-gradient-to-l from-cyan-950/50 via-[#0a1824]/60 to-transparent p-2.5 transition-all hover:border-cyan-500/60 lg:col-span-4">
          <div className="text-left font-mono tabular-nums">
            <span className="block text-[9.5px] font-medium text-slate-500">탈출 성공률</span>
            <span className="text-sm font-black text-cyan-300">
              {successPct !== null ? `${successPct.toFixed(1)}%` : "—"}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-right">
            <div className="min-w-0">
              <div className="flex items-center justify-end gap-1.5">
                <span className="rounded bg-cyan-950/80 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-cyan-400 border border-cyan-800/60">
                  탈출 AI · 방어
                </span>
                <span className="font-mono text-xs font-black tracking-wider text-cyan-300">
                  Q-LEARNING
                </span>
              </div>
              <div className="truncate font-mono text-xs font-bold text-slate-100">
                {solverStatusSummary}
              </div>
              <div className="truncate text-[10px] text-slate-400">
                {qReport ? `평균 ${qReport.avg_steps.toFixed(1)}보 · 보상 ${qReport.avg_reward.toFixed(1)}` : "탐색 준비 중"}
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cyan-500/60 bg-cyan-950/90 shadow-[0_0_12px_rgba(6,182,212,0.35)]">
              <Navigation className="h-4.5 w-4.5 text-cyan-300" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
