import {
  edgeToSegment,
  extractEditEdges,
  formatEditTarget,
  parseEdgeWalls,
} from "../maze/wallUtils";
import {
  getBuilderActionLabel,
  type BuilderMode,
  type Coord,
  type EditHistoryEntry,
  type MazeEdit,
  type RoundResult,
} from "../types/simulation";

interface BuilderPanelProps {
  builderMode: BuilderMode;
  lastResult: RoundResult | null;
  currentGrid: number[][];
  currentWalls?: unknown;
  currentStart: Coord;
  currentGoal: Coord;
  prevGrid: number[][] | null;
  prevWalls?: unknown;
  editHistory: EditHistoryEntry[];
  era: number;
  eraSizes: number[];
}

const RATE_LABELS = ["낮음", "보통", "높음"];
const PATH_LABELS = ["짧음", "보통", "김"];
const ACTION_COLUMNS = ["block_hot", "block_path", "move_to_path", "move_to_hot"] as const;

function MiniMazeSvg({
  grid,
  walls,
  start,
  goal,
  edit,
  highlightColor,
  label,
}: {
  grid: number[][] | null;
  walls?: unknown;
  start: Coord;
  goal: Coord;
  edit: MazeEdit | null;
  highlightColor: string;
  label: string;
}) {
  if (!grid || grid.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-lab-border bg-lab-bg p-2">
        <span className="font-mono text-[10px] text-slate-500">{label}</span>
        <div className="flex h-[78px] w-[78px] items-center justify-center font-mono text-[10px] text-slate-600">
          없음
        </div>
      </div>
    );
  }

  const size = grid.length;
  const view = 78;
  const cell = view / size;
  const edgeWalls = parseEdgeWalls(walls);
  const isEdgeMode = edgeWalls !== null;
  const { targetEdge, targetCell } = extractEditEdges(edit);

  return (
    <div className="flex flex-col items-center border border-lab-border bg-lab-bg p-2">
      <span className="mb-1 font-mono text-[10px] text-slate-400">{label}</span>
      <svg
        viewBox={`0 0 ${view} ${view}`}
        className="h-[78px] w-[78px]"
        role="img"
        aria-label={`${label} 미로 비교`}
      >
        {grid.map((rowArr, r) =>
          rowArr.map((val, c) => {
            const isStart = r === start[0] && c === start[1];
            const isGoal = r === goal[0] && c === goal[1];
            const fill = isStart
              ? "#065f46"
              : isGoal
                ? "#0f766e"
                : !isEdgeMode && val === 1
                  ? "#334766"
                  : "#0e1726";
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cell}
                y={r * cell}
                width={cell}
                height={cell}
                fill={fill}
                stroke="#1a263b"
                strokeWidth={0.5}
              />
            );
          }),
        )}

        {isEdgeMode &&
          edgeWalls.map((edge) => {
            const seg = edgeToSegment(edge, cell, 0);
            return (
              <line
                key={`mini-${edge.key}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke="#cbd5e1"
                strokeWidth={Math.max(1.5, cell * 0.14)}
                strokeLinecap="round"
              />
            );
          })}

        {targetEdge && (() => {
          const seg = edgeToSegment(targetEdge, cell, 0);
          return (
            <line
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={highlightColor}
              strokeWidth={Math.max(2.2, cell * 0.2)}
              strokeLinecap="round"
            />
          );
        })()}

        {!targetEdge &&
          targetCell &&
          targetCell[0] < size &&
          targetCell[1] < size && (
            <rect
              x={targetCell[1] * cell + 0.8}
              y={targetCell[0] * cell + 0.8}
              width={Math.max(2, cell - 1.6)}
              height={Math.max(2, cell - 1.6)}
              fill="none"
              stroke={highlightColor}
              strokeWidth={1.8}
            />
          )}
      </svg>
    </div>
  );
}

function qCellBackground(value: number, minVal: number, maxVal: number): string {
  if (maxVal === minVal) return "rgba(30, 41, 59, 0.55)";
  const norm = (value - minVal) / (maxVal - minVal);
  if (value >= 0) {
    const alpha = 0.14 + norm * 0.55;
    return `rgba(139, 92, 246, ${alpha.toFixed(2)})`;
  }
  const alpha = 0.16 + (1 - norm) * 0.45;
  return `rgba(244, 63, 94, ${alpha.toFixed(2)})`;
}

export function BuilderPanel({
  builderMode,
  lastResult,
  currentGrid,
  currentWalls,
  currentStart,
  currentGoal,
  prevGrid,
  prevWalls,
  editHistory,
  era,
  eraSizes,
}: BuilderPanelProps) {
  const proposedEdits = editHistory.filter((e) => e.edit !== null || e.edit_type !== null);
  const appliedCount = proposedEdits.filter((e) => !e.edit_reverted).length;
  const revertedCount = proposedEdits.filter((e) => e.edit_reverted).length;

  const nextEraSize =
    lastResult?.next_size ?? (era < eraSizes.length ? eraSizes[era] : null);
  const afterGrid = lastResult ? lastResult.grid : currentGrid;
  const afterWalls = lastResult ? lastResult.walls : currentWalls;
  const displayStart = lastResult ? lastResult.start : currentStart;
  const displayGoal = lastResult ? lastResult.goal : currentGoal;
  const latestEdit = lastResult?.edit ?? null;
  const highlightColor = lastResult?.edit_reverted ? "#f43f5e" : "#a78bfa";

  const qTable = lastResult?.builder_q_table ?? null;
  const { qMin, qMax } = (() => {
    if (!qTable) return { qMin: 0, qMax: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const row of qTable) {
      for (const col of row) {
        for (const val of col) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }
    return Number.isFinite(min) ? { qMin: min, qMax: max } : { qMin: 0, qMax: 0 };
  })();

  const recentLogs = [...editHistory].reverse().slice(0, 10);
  const latestActionLabel = getBuilderActionLabel(lastResult?.builder_action_name);

  return (
    <section className="min-w-0 overflow-hidden border border-lab-border border-l-2 border-l-violet-400 bg-lab-surface">
      <div className="flex items-center justify-between border-b border-lab-border px-3 py-2">
        <div>
          <h2 className="font-mono text-xs font-semibold text-violet-300">
            미로 제작 AI · {builderMode === "sarsa" ? "SARSA" : "규칙 기반"}
          </h2>
          <p className="text-[11px] text-slate-500">
            미로 수정 정책, 9×4 Q값 히트맵 및 변경 전후 비교
          </p>
        </div>
        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
          다음 시대: {nextEraSize ? `${nextEraSize}×${nextEraSize}` : "최종 시대"}
        </span>
      </div>

      <div className="space-y-3 p-3">
        {/* 제작 AI 핵심 지표 */}
        <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums sm:grid-cols-4">
          <div className="border border-lab-border bg-lab-bg px-2 py-1.5">
            <div className="text-[10px] text-slate-500">적용 수정</div>
            <div className="font-semibold text-violet-300">{appliedCount}회</div>
          </div>
          <div className="border border-lab-border bg-lab-bg px-2 py-1.5">
            <div className="text-[10px] text-slate-500">되돌린 수정</div>
            <div className="font-semibold text-rose-400">{revertedCount}회</div>
          </div>
          <div className="border border-lab-border bg-lab-bg px-2 py-1.5">
            <div className="text-[10px] text-slate-500">보상</div>
            <div
              className={`font-semibold ${
                (lastResult?.builder_reward ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {lastResult ? lastResult.builder_reward.toFixed(2) : "—"}
            </div>
          </div>
          <div className="border border-lab-border bg-lab-bg px-2 py-1.5">
            <div className="text-[10px] text-slate-500">제작 AI 행동</div>
            <div
              className="truncate text-[11px] font-semibold text-violet-200"
              title={latestActionLabel}
            >
              {latestActionLabel}
            </div>
          </div>
        </div>

        {/* 변경 전후 미로 비교 */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
          <div className="grid grid-cols-2 gap-2">
            <MiniMazeSvg
              grid={prevGrid}
              walls={prevWalls}
              start={displayStart}
              goal={displayGoal}
              edit={latestEdit}
              highlightColor={highlightColor}
              label="변경 전"
            />
            <MiniMazeSvg
              grid={afterGrid}
              walls={afterWalls}
              start={displayStart}
              goal={displayGoal}
              edit={latestEdit}
              highlightColor={highlightColor}
              label="변경 후"
            />
          </div>

          <div className="flex flex-col justify-between border border-lab-border bg-lab-bg p-2.5 font-mono text-[11px]">
            <div>
              <div className="text-[10px] text-slate-500">최근 미로 수정</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-100">
                  {formatEditTarget(latestEdit)}
                </span>
                {latestEdit && (
                  <span
                    className={`border px-1 text-[9px] font-semibold ${
                      lastResult?.edit_reverted
                        ? "border-rose-700 bg-rose-950/70 text-rose-300"
                        : "border-violet-700 bg-violet-950/70 text-violet-200"
                    }`}
                  >
                    {lastResult?.edit_reverted ? "되돌림" : "적용됨"}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-1 border-t border-lab-border pt-2 text-[10px] text-slate-400">
              <div className="flex justify-between gap-2">
                <span>선택 행동</span>
                <span className="text-violet-300">
                  {lastResult?.builder_action_name
                    ? `${lastResult.builder_action} · ${getBuilderActionLabel(lastResult.builder_action_name)}`
                    : "없음"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>제작 AI 상태</span>
                <span className="text-slate-200">
                  {lastResult?.builder_state
                    ? `[${lastResult.builder_state[0]}, ${lastResult.builder_state[1]}]`
                    : "없음"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>현재 미로 크기</span>
                <span className="text-sky-300">
                  {afterGrid.length}×{afterGrid.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 미로 제작 AI Q값 히트맵 (상태 9개 × 행동 4개) */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>미로 제작 AI Q값 히트맵 (상태 9개 × 행동 4개)</span>
            <span>{qTable ? "SARSA 학습 Q값" : "규칙 기반 · Q값 없음"}</span>
          </div>

          {qTable === null ? (
            <div className="border border-lab-border bg-lab-bg px-3 py-3 text-center font-mono text-[11px] text-slate-500">
              {builderMode === "rule"
                ? "규칙 기반 미로 제작 AI는 Q값 테이블을 사용하지 않습니다."
                : "최소 1라운드를 실행하면 SARSA 미로 제작 AI의 Q값 히트맵이 표시됩니다."}
            </div>
          ) : (
            <div className="overflow-x-auto border border-lab-border bg-lab-bg">
              <table className="w-full border-collapse font-mono text-[10px] tabular-nums">
                <thead>
                  <tr className="border-b border-lab-border bg-lab-surface text-[9px] text-slate-400">
                    <th className="whitespace-nowrap px-1.5 py-1 text-left">상태 (성공률/경로)</th>
                    {ACTION_COLUMNS.map((act) => (
                      <th key={act} className="whitespace-nowrap px-1.5 py-1 text-right">
                        {getBuilderActionLabel(act)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-lab-border/50">
                  {qTable.flatMap((rateSlice, rIdx) =>
                    rateSlice.map((actionVals, pIdx) => {
                      const isActiveState =
                        lastResult?.builder_state?.[0] === rIdx &&
                        lastResult?.builder_state?.[1] === pIdx;
                      return (
                        <tr
                          key={`qrow-${rIdx}-${pIdx}`}
                          className={isActiveState ? "bg-slate-800/50" : ""}
                        >
                          <td className="whitespace-nowrap px-1.5 py-1 text-slate-300">
                            <span className={isActiveState ? "font-semibold text-violet-300" : ""}>
                              ({rIdx},{pIdx}) {RATE_LABELS[rIdx]}/{PATH_LABELS[pIdx]}
                            </span>
                          </td>
                          {actionVals.map((val, aIdx) => {
                            const isSelectedCell =
                              isActiveState && lastResult?.builder_action === aIdx;
                            return (
                              <td
                                key={`qcell-${rIdx}-${pIdx}-${aIdx}`}
                                className={`px-1.5 py-1 text-right text-slate-100 ${
                                  isSelectedCell ? "font-bold ring-1 ring-inset ring-violet-300" : ""
                                }`}
                                style={{ backgroundColor: qCellBackground(val, qMin, qMax) }}
                              >
                                {val.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 미로 수정 및 되돌리기 이력 */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>미로 수정 및 되돌리기 이력</span>
            <span className="tabular-nums">총 {editHistory.length}라운드 기록</span>
          </div>
          <div className="max-h-[130px] overflow-y-auto border border-lab-border bg-lab-bg font-mono text-[11px] tabular-nums">
            {recentLogs.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-slate-500">
                표시할 데이터가 없습니다. 시작 또는 한 라운드 실행을 눌러 주세요.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 border-b border-lab-border bg-lab-surface text-[9px] text-slate-500">
                  <tr>
                    <th className="px-2 py-1">라운드</th>
                    <th className="px-2 py-1">제작 AI 행동</th>
                    <th className="px-2 py-1">수정 내용</th>
                    <th className="px-2 py-1 text-right">보상</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lab-border/60">
                  {recentLogs.map((entry) => (
                    <tr key={`edit-r-${entry.round}`} className="hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-2 py-1 text-slate-400">
                        라운드 {entry.round}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-violet-300">
                        {getBuilderActionLabel(entry.builder_action_name)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1">
                        <span
                          className={
                            entry.edit_reverted
                              ? "text-rose-400 line-through"
                              : entry.edit || entry.edit_type
                                ? "text-slate-200"
                                : "text-slate-500"
                          }
                        >
                          {formatEditTarget(entry.edit, entry.edit_type)}
                        </span>
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-1 text-right font-semibold ${
                          entry.builder_reward >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {entry.builder_reward >= 0 ? "+" : ""}
                        {entry.builder_reward.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
