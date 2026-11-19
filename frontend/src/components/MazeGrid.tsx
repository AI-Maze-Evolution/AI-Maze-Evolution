import { useMemo, useState } from "react";
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

const OVERLAY_OPTIONS: { id: OverlayMode; label: string }[] = [
  { id: "paths", label: "미로 + 이동 경로" },
  { id: "q_heatmap", label: "Q값 히트맵" },
  { id: "visits", label: "방문 횟수" },
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

  // 초기화 직후(lastResult === null)에는 해당 시대의 고정 초기 배치(currentGrid/currentWalls)를 표시하고,
  // 라운드 진행 중에는 반드시 lastResult의 미로·벽·start·goal에 경로와 히트맵을 겹쳐 그린다.
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
        ? "시작점"
        : r === displayGoal[0] && c === displayGoal[1]
          ? "도착점"
          : parsedEdges === null && cellVal === 1
            ? "벽"
            : "이동 경로";
    const qMax = lastResult?.q_values_max.q[r]?.[c];
    const visits = lastResult?.reports.q.visit_counts[r]?.[c];
    return { r, c, typeLabel, qMax, visits };
  })();

  return (
    <section className="flex flex-col border border-lab-border bg-lab-surface">
      {/* 상단 도구 모음 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lab-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-xs font-semibold text-slate-100">
            {lastResult ? `라운드 ${lastResult.round} 미로 시뮬레이션` : "초기 고정 미로 배치"}
          </h2>
          <span className="border border-lab-border bg-lab-bg px-1.5 py-0.5 font-mono text-[10px] text-sky-300 tabular-nums">
            {size}×{size}
          </span>
          <span className="border border-lab-border bg-lab-bg px-1.5 py-0.5 font-mono text-[10px] text-slate-300 tabular-nums">
            {parsedEdges !== null ? `경계선 벽 ${wallCount}개` : `벽 ${wallCount}개`}
          </span>
          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
            S({displayStart[0]},{displayStart[1]}) → G({displayGoal[0]},{displayGoal[1]})
          </span>
          {lastResult?.era_changed && lastResult.next_size && (
            <span className="border border-emerald-600/60 bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
              다음 시대 준비됨 · {lastResult.next_size}×{lastResult.next_size}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-lab-border bg-lab-bg font-mono text-[11px]">
            {OVERLAY_OPTIONS.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setOverlayMode(opt.id)}
                className={`whitespace-nowrap px-2 py-1 transition-colors ${
                  idx > 0 ? "border-l border-lab-border" : ""
                } ${
                  overlayMode === opt.id
                    ? "bg-slate-800 font-semibold text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            title="Q-Learning 탈출 경로 표시를 켜거나 끕니다"
            onClick={() => setShowPath((v) => !v)}
            className={`whitespace-nowrap border border-lab-border px-2 py-1 font-mono text-[11px] transition-colors ${
              showPath ? "bg-sky-950/80 text-sky-300" : "bg-lab-bg text-slate-500"
            }`}
          >
            탈출 경로
          </button>
        </div>
      </div>

      {/* 메인 SVG 미로 영역 */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-[#080d16] p-4 sm:p-5">
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

        {/* 최적 경로 재생 및 셀 정보 표시줄 */}
        <div className="mt-3 flex w-full max-w-[540px] flex-wrap items-center justify-between gap-2 border border-lab-border bg-lab-surface/90 px-3 py-1.5 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[10px] text-slate-400">최적 경로 재생</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, maxPathSteps)}
              value={Math.min(stepIndex, Math.max(0, maxPathSteps))}
              disabled={maxPathSteps === 0}
              onChange={(e) => onStepIndexChange(Number(e.target.value))}
              className="lab-slider w-24 sm:w-32"
              aria-label="최적 경로 재생 단계"
            />
            <span className="w-12 text-right text-slate-300 tabular-nums">
              {Math.min(stepIndex, maxPathSteps)}/{maxPathSteps}
            </span>
            <button
              type="button"
              title="현재 라운드 최적 경로를 처음부터 다시 재생합니다"
              disabled={maxPathSteps === 0}
              onClick={onReplayPath}
              className="whitespace-nowrap border border-lab-border bg-lab-bg px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-slate-500 disabled:opacity-35"
            >
              다시 재생
            </button>
          </div>

          <div className="text-[10px] text-slate-400 tabular-nums">
            {hoverTelemetry ? (
              <span>
                ({hoverTelemetry.r},{hoverTelemetry.c}) {hoverTelemetry.typeLabel}
                {hoverTelemetry.qMax !== undefined && (
                  <>
                    {" · "}
                    <span className="text-sky-300">Q값: {hoverTelemetry.qMax.toFixed(1)}</span>
                    {" · "}방문 횟수: {hoverTelemetry.visits ?? 0}
                  </>
                )}
              </span>
            ) : (
              <span>칸에 마우스를 올리면 Q값과 방문 횟수가 표시됩니다</span>
            )}
          </div>
        </div>
      </div>

      <MazeLegend />
    </section>
  );
}
