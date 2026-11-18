import { useState } from "react";
import { MazeLegend } from "../maze/MazeLegend";
import { MazeRenderer } from "../maze/MazeRenderer";
import type { Coord, OverlayMode, RoundResult } from "../types/simulation";

interface MazeGridProps {
  currentGrid: number[][];
  currentStart: Coord;
  currentGoal: Coord;
  prevGrid: number[][] | null;
  lastResult: RoundResult | null;
  stepIndex: number;
  maxPathSteps: number;
  onStepIndexChange: (step: number) => void;
  onReplayPath: () => void;
}

const OVERLAY_OPTIONS: { id: OverlayMode; label: string }[] = [
  { id: "paths", label: "Grid + Path" },
  { id: "q_heatmap", label: "Q Max-Q" },
  { id: "visits", label: "Visits" },
];

export function MazeGrid({
  currentGrid,
  currentStart,
  currentGoal,
  prevGrid,
  lastResult,
  stepIndex,
  maxPathSteps,
  onStepIndexChange,
  onReplayPath,
}: MazeGridProps) {
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("paths");
  const [showPath, setShowPath] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<Coord | null>(null);

  // docs/interface.md §15: 경로·Q 히트맵·방문횟수는 반드시 last_result.grid에 겹쳐 그려야
  // 시대 전환 직후 next_size의 SimulationState.grid와 크기가 섞이지 않는다.
  const displayGrid = lastResult ? lastResult.grid : currentGrid;
  const displayStart = lastResult ? lastResult.start : currentStart;
  const displayGoal = lastResult ? lastResult.goal : currentGoal;
  const size = displayGrid.length || 5;
  const qPath = lastResult?.best_paths.q ?? [];

  const hoverTelemetry = (() => {
    if (!hoveredCell) return null;
    const [r, c] = hoveredCell;
    const cellVal = displayGrid[r]?.[c];
    const typeLabel =
      r === displayStart[0] && c === displayStart[1]
        ? "START"
        : r === displayGoal[0] && c === displayGoal[1]
          ? "GOAL"
          : cellVal === 1
            ? "WALL"
            : "PATH";
    const qMax = lastResult?.q_values_max.q[r]?.[c];
    const visits = lastResult?.reports.q.visit_counts[r]?.[c];
    return { r, c, typeLabel, qMax, visits };
  })();

  return (
    <section className="flex flex-col border border-lab-border bg-lab-surface">
      {/* Stage Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lab-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-100">
            {lastResult ? `Round ${lastResult.round} Maze` : "Initial Maze Environment"}
          </h2>
          <span className="border border-lab-border bg-lab-bg px-1.5 py-0.5 font-mono text-[10px] text-sky-300 tabular-nums">
            {size}×{size}
          </span>
          {lastResult?.era_changed && lastResult.next_size && (
            <span className="border border-emerald-600/60 bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
              NEXT ERA READY · {lastResult.next_size}×{lastResult.next_size}
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
                className={`px-2 py-1 transition-colors ${
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
            onClick={() => setShowPath((v) => !v)}
            className={`border border-lab-border px-2 py-1 font-mono text-[11px] transition-colors ${
              showPath ? "bg-sky-950/80 text-sky-300" : "bg-lab-bg text-slate-500"
            }`}
          >
            Q Path
          </button>
        </div>
      </div>

      {/* Main SVG Viewport */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-[#080d16] p-4 sm:p-5">
        <MazeRenderer
          grid={displayGrid}
          start={displayStart}
          goal={displayGoal}
          prevGrid={prevGrid}
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

        {/* Best-Path Playback & Cell Inspector Bar */}
        <div className="mt-3 flex w-full max-w-[540px] flex-wrap items-center justify-between gap-2 border border-lab-border bg-lab-surface/90 px-3 py-1.5 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-slate-500">Best-Path Playback</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, maxPathSteps)}
              value={Math.min(stepIndex, Math.max(0, maxPathSteps))}
              disabled={maxPathSteps === 0}
              onChange={(e) => onStepIndexChange(Number(e.target.value))}
              className="lab-slider w-24 sm:w-32"
              aria-label="Best path playback step"
            />
            <span className="w-12 text-right text-slate-300 tabular-nums">
              {Math.min(stepIndex, maxPathSteps)}/{maxPathSteps}
            </span>
            <button
              type="button"
              disabled={maxPathSteps === 0}
              onClick={onReplayPath}
              className="border border-lab-border bg-lab-bg px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-slate-500 disabled:opacity-35"
            >
              REPLAY
            </button>
          </div>

          <div className="text-[10px] text-slate-400 tabular-nums">
            {hoverTelemetry ? (
              <span>
                ({hoverTelemetry.r},{hoverTelemetry.c}) {hoverTelemetry.typeLabel}
                {hoverTelemetry.qMax !== undefined && (
                  <>
                    {" · "}
                    <span className="text-sky-300">Q:{hoverTelemetry.qMax.toFixed(1)}</span>
                    {" · "}Visits:{hoverTelemetry.visits ?? 0}
                  </>
                )}
              </span>
            ) : (
              <span>Hover any cell for Q-value &amp; visit telemetry</span>
            )}
          </div>
        </div>
      </div>

      <MazeLegend />
    </section>
  );
}
