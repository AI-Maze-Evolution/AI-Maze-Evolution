import { useMemo, useState } from "react";
import { Compass, Eye, Flame, Layers, MapPin, RotateCcw } from "lucide-react";
import { MazeLegend } from "../maze/MazeLegend";
import { MazeRenderer } from "../maze/MazeRenderer";
import { parseEdgeWalls } from "../maze/wallUtils";
import type { Coord, OverlayMode, RoundResult } from "../types/simulation";

interface MazeGridProps {
  currentGrid: number[][];
  currentWalls?: unknown;
  currentStart: Coord;
  currentGoal: Coord;
  prevGrid: number[][] | null;
  prevWalls?: unknown;
  lastResult: RoundResult | null;
  stepIndex: number;
  maxPathSteps: number;
  onStepIndexChange: (step: number) => void;
  onReplayPath: () => void;
}

const OVERLAY_OPTIONS: { id: OverlayMode; label: string; icon: typeof Eye }[] = [
  { id: "paths", label: "경로 추적", icon: Compass },
  { id: "q_heatmap", label: "Q-Value 히트맵", icon: Flame },
  { id: "visits", label: "방문 빈도", icon: Layers },
];

export function MazeGrid({
  currentGrid,
  currentWalls,
  currentStart,
  currentGoal,
  prevGrid,
  prevWalls,
  lastResult,
  stepIndex,
  maxPathSteps,
  onStepIndexChange,
  onReplayPath,
}: MazeGridProps) {
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("paths");
  const [showPath, setShowPath] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<Coord | null>(null);

  const displayGrid = lastResult ? lastResult.grid : currentGrid;
  const displayWalls = lastResult ? lastResult.walls : currentWalls;
  const displayStart = lastResult ? lastResult.start : currentStart;
  const displayGoal = lastResult ? lastResult.goal : currentGoal;
  const size = displayGrid.length || 5;
  const qPath = lastResult?.best_paths.q ?? [];

  const parsedEdges = useMemo(() => parseEdgeWalls(displayWalls), [displayWalls]);
  const wallCount = useMemo(() => {
    if (parsedEdges !== null) return parsedEdges.length;
    let count = 0;
    for (const row of displayGrid) {
      for (const cell of row) {
        if (cell === 1) count += 1;
      }
    }
    return count;
  }, [parsedEdges, displayGrid]);

  const hoverTelemetry = (() => {
    if (!hoveredCell) return null;
    const [r, c] = hoveredCell;
    const cellVal = displayGrid[r]?.[c];
    const typeLabel =
      r === displayStart[0] && c === displayStart[1]
        ? "출발지(Start)"
        : r === displayGoal[0] && c === displayGoal[1]
          ? "목적지(Goal)"
          : parsedEdges === null && cellVal === 1
            ? "차단된 벽"
            : "이동 가능 통로";
    const qMax = lastResult?.q_values_max.q[r]?.[c];
    const visits = lastResult?.reports.q.visit_counts[r]?.[c];
    return { r, c, typeLabel, qMax, visits };
  })();

  return (
    <section className="instrument-card flex flex-col overflow-hidden rounded-md shadow-xl">
      {/* 챔버 상단 헤더 & 컨트롤 도구 모음 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b273b] bg-[#0a101b] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
            </span>
            <h2 className="font-mono text-xs font-black tracking-wide text-slate-100 flex items-center gap-1.5">
              <span>{lastResult ? `라운드 ${lastResult.round} 공진화 전투 아레나` : "초기 미로 대결 준비"}</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-300 border border-slate-700">
                실시간 관전
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
            <span className="rounded border border-sky-800/60 bg-sky-950/40 px-2 py-0.5 font-bold text-sky-300">
              {size}×{size}
            </span>
            <span className="rounded border border-[#1e2e47] bg-[#0d1524] px-2 py-0.5 font-medium text-slate-300">
              {parsedEdges !== null ? `경계선 벽 ${wallCount}개` : `벽 ${wallCount}개`}
            </span>
            <span className="rounded border border-[#1e2e47] bg-[#0d1524] px-2 py-0.5 text-slate-400">
              S({displayStart[0]},{displayStart[1]}) → G({displayGoal[0]},{displayGoal[1]})
            </span>
          </div>

          {lastResult?.era_changed && lastResult.next_size && (
            <span className="animate-pulse rounded border border-emerald-500/60 bg-emerald-950/70 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              다음 시대 진화 활성화 · {lastResult.next_size}×{lastResult.next_size}
            </span>
          )}
        </div>

        {/* 오버레이 모드 전환 세그먼트 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[#1c293e] bg-[#070b13] p-0.5 font-mono text-[11px]">
            {OVERLAY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = overlayMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOverlayMode(opt.id)}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-semibold transition-all ${
                    isActive
                      ? "bg-sky-600 text-white shadow-[0_0_10px_rgba(56,189,248,0.35)]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            title="Q-Learning 탈출 경로 시각화 토글"
            onClick={() => setShowPath((v) => !v)}
            className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-mono text-[11px] font-semibold transition-all ${
              showPath
                ? "border-sky-500/70 bg-sky-950/60 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                : "border-[#1e2d45] bg-[#090e18] text-slate-500"
            }`}
          >
            <Eye className="h-3 w-3" />
            경로 표시
          </button>
        </div>
      </div>

      {/* 메인 시뮬레이션 캔버스 뷰포트 */}
      <div className="lab-grid-bg relative flex flex-1 flex-col items-center justify-center p-2.5 sm:p-3.5">
        {/* 장치 코너 데코레이터: 공격 SARSA 보라 & 방어 Q-Learning 사이언 테마 */}
        <div className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-violet-500/80 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
        <div className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-violet-500/80 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-cyan-500/80 shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-cyan-500/80 shadow-[0_0_8px_rgba(6,182,212,0.4)]" />

        <div className="relative flex w-full max-w-[700px] items-center justify-center rounded-lg border border-[#1f2d47] bg-[#070c16] p-2 sm:p-3 shadow-[0_0_35px_rgba(0,0,0,0.6)]">
          <MazeRenderer
            grid={displayGrid}
            walls={displayWalls}
            start={displayStart}
            goal={displayGoal}
            prevGrid={prevGrid}
            prevWalls={prevWalls}
            edit={lastResult?.edit ?? null}
            editReverted={lastResult?.edit_reverted ?? false}
            qPath={qPath}
            qHeatmap={lastResult?.q_values_max.q ?? null}
            visitCounts={lastResult?.reports.q.visit_counts ?? null}
            overlayMode={overlayMode}
            stepIndex={stepIndex}
            showPath={showPath}
            hoveredCell={hoveredCell}
            onHoverCell={setHoveredCell}
          />
        </div>

        {/* 하단 인터랙티브 재생 스크러버 및 셀 텔레메트리 */}
        <div className="mt-3 flex w-full max-w-[700px] flex-wrap items-center justify-between gap-3 rounded border border-[#1b283d] bg-[#0c1322]/90 px-3.5 py-2 font-mono text-xs backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-medium text-slate-400">재생 제어</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, maxPathSteps)}
              value={Math.min(stepIndex, Math.max(0, maxPathSteps))}
              disabled={maxPathSteps === 0}
              onChange={(e) => onStepIndexChange(Number(e.target.value))}
              className="lab-slider w-24 sm:w-36"
              aria-label="최적 경로 스크러버"
            />
            <span className="w-12 text-right font-bold text-sky-300 tabular-nums">
              {Math.min(stepIndex, maxPathSteps)}/{maxPathSteps}
            </span>
            <button
              type="button"
              title="최적 경로 처음부터 다시 재생"
              disabled={maxPathSteps === 0}
              onClick={onReplayPath}
              className="inline-flex items-center gap-1 rounded border border-[#22334e] bg-[#0a0f1a] px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition-colors hover:border-sky-500 hover:text-sky-200 disabled:opacity-35"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              다시 재생
            </button>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400 tabular-nums">
            <MapPin className="h-3 w-3 text-slate-500" />
            {hoverTelemetry ? (
              <span>
                <span className="font-bold text-slate-200">
                  ({hoverTelemetry.r}, {hoverTelemetry.c})
                </span>{" "}
                <span className="text-slate-400">{hoverTelemetry.typeLabel}</span>
                {hoverTelemetry.qMax !== undefined && (
                  <>
                    {" · "}
                    <span className="font-bold text-sky-300">
                      Q: {hoverTelemetry.qMax.toFixed(1)}
                    </span>
                    {" · "}
                    <span className="text-slate-300">
                      방문: {hoverTelemetry.visits ?? 0}회
                    </span>
                  </>
                )}
              </span>
            ) : (
              <span className="text-slate-500">칸에 커서를 올리면 좌표·Q값·방문수가 표시됩니다</span>
            )}
          </div>
        </div>
      </div>

      <MazeLegend />
    </section>
  );
}
