import { Brain, History, Layers } from "lucide-react";
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

const RATE_LABELS = ["성공률 낮음", "성공률 보통", "성공률 높음"];
const PATH_LABELS = ["경로 짧음", "경로 보통", "경로 김"];
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
      <div className="flex flex-col items-center justify-center rounded border border-[#1b273b] bg-[#090e18] p-2">
        <span className="font-mono text-[10px] text-slate-500">{label}</span>
        <div className="flex h-[84px] w-[84px] items-center justify-center font-mono text-[10px] text-slate-600">
          데이터 없음
        </div>
      </div>
    );
  }

  const size = grid.length;
  const view = 84;
  const cell = view / size;
  const edgeWalls = parseEdgeWalls(walls);
  const isEdgeMode = edgeWalls !== null;
  const { targetEdge, targetCell } = extractEditEdges(edit);

  return (
    <div className="flex flex-col items-center rounded border border-[#1b273b] bg-[#090e18] p-2">
      <span className="mb-1 font-mono text-[10.5px] font-medium text-slate-400">{label}</span>
      <svg
        viewBox={`0 0 ${view} ${view}`}
        className="h-[84px] w-[84px] rounded border border-[#1d2b42] bg-[#060a12]"
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
                  ? "#22334e"
                  : "#0b1220";
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cell}
                y={r * cell}
                width={cell}
                height={cell}
                fill={fill}
                stroke="#152136"
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
                strokeWidth={Math.max(1.6, cell * 0.15)}
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
              strokeWidth={Math.max(2.4, cell * 0.22)}
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
              strokeWidth={2}
            />
          )}
      </svg>
    </div>
  );
}

function qCellBackground(value: number, minVal: number, maxVal: number): string {
  if (maxVal === minVal) return "rgba(30, 41, 59, 0.4)";
  const norm = (value - minVal) / (maxVal - minVal);
  if (value >= 0) {
    const alpha = 0.15 + norm * 0.6;
    return `rgba(139, 92, 246, ${alpha.toFixed(2)})`;
  }
  const alpha = 0.16 + (1 - norm) * 0.5;
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

  const recentLogs = [...editHistory].reverse().slice(0, 8);
  const latestActionLabel = getBuilderActionLabel(lastResult?.builder_action_name);

  return (
    <section className="instrument-card min-w-0 overflow-hidden rounded-md border-l-4 border-l-violet-500 shadow-lg">
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between border-b border-[#1b273b] bg-gradient-to-r from-violet-950/40 via-[#0a0d18] to-transparent px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-violet-950 border border-violet-500/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
            <Brain className="h-4 w-4 text-violet-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-mono text-xs font-black tracking-wide text-violet-200">
                SARSA · 미로 제작 AI
              </h2>
              <span className="rounded bg-violet-950 px-1.5 py-0.2 font-mono text-[9px] font-black text-violet-300 border border-violet-700/70">
                공격 · 방해
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {builderMode === "sarsa" ? "SARSA 상태 전이 학습" : "규칙 기반 휴리스틱"} · 경로 차단 시도
            </p>
          </div>
        </div>

        <span className="rounded border border-[#1e2e47] bg-[#0c1424] px-2 py-0.5 font-mono text-[11px] font-semibold text-violet-300 tabular-nums">
          다음 목표: {nextEraSize ? `${nextEraSize}×${nextEraSize}` : "최종 시대"}
        </span>
      </div>

      <div className="space-y-3 p-3.5">
        {/* 핵심 수정 지표 셀 */}
        <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums sm:grid-cols-4">
          <div className="rounded border border-[#1b283d] bg-[#090e18] p-2">
            <div className="text-[10px] font-medium text-slate-500">적용 수정</div>
            <div className="mt-0.5 text-sm font-bold text-violet-300">{appliedCount}회</div>
          </div>
          <div className="rounded border border-[#1b283d] bg-[#090e18] p-2">
            <div className="text-[10px] font-medium text-slate-500">되돌린 수정</div>
            <div className="mt-0.5 text-sm font-bold text-rose-400">{revertedCount}회</div>
          </div>
          <div className="rounded border border-[#1b283d] bg-[#090e18] p-2">
            <div className="text-[10px] font-medium text-slate-500">제작 보상</div>
            <div
              className={`mt-0.5 text-sm font-bold ${
                (lastResult?.builder_reward ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {lastResult ? lastResult.builder_reward.toFixed(2) : "—"}
            </div>
          </div>
          <div className="rounded border border-[#1b283d] bg-[#090e18] p-2">
            <div className="text-[10px] font-medium text-slate-500">최근 행동</div>
            <div
              className="mt-0.5 truncate text-xs font-bold text-violet-200"
              title={latestActionLabel}
            >
              {latestActionLabel}
            </div>
          </div>
        </div>

        {/* 미로 수정 전/후 실시간 시각적 비교 */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[auto_1fr]">
          <div className="flex gap-2">
            <MiniMazeSvg
              grid={prevGrid}
              walls={prevWalls}
              start={displayStart}
              goal={displayGoal}
              edit={latestEdit}
              highlightColor={highlightColor}
              label="수정 전"
            />
            <MiniMazeSvg
              grid={afterGrid}
              walls={afterWalls}
              start={displayStart}
              goal={displayGoal}
              edit={latestEdit}
              highlightColor={highlightColor}
              label="수정 후"
            />
          </div>

          <div className="flex flex-col justify-between rounded border border-[#1b283d] bg-[#090e18] p-2.5 font-mono text-xs">
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>최근 미로 수정 내용</span>
                <span className="text-sky-300">{afterGrid.length}×{afterGrid.length}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-100">
                  {latestEdit
                    ? formatEditTarget(latestEdit)
                    : lastResult?.builder_action_name
                      ? "수정 건너뜀 (최단 경로 보호)"
                      : "수정 없음"}
                </span>
                {latestEdit ? (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      lastResult?.edit_reverted
                        ? "border border-rose-600/60 bg-rose-950/70 text-rose-300"
                        : "border border-violet-600/60 bg-violet-950/70 text-violet-200"
                    }`}
                  >
                    {lastResult?.edit_reverted ? "되돌림" : "적용됨"}
                  </span>
                ) : lastResult?.builder_action_name ? (
                  <span className="rounded border border-amber-600/60 bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                    경로 유지
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-2 space-y-1 border-t border-[#182438] pt-2 text-[11px] text-slate-400">
              <div className="flex justify-between gap-2">
                <span>선택된 정책 행동</span>
                <span className="font-bold text-violet-300">
                  {lastResult?.builder_action_name
                    ? `${lastResult.builder_action}번 · ${getBuilderActionLabel(lastResult.builder_action_name)}`
                    : "없음"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>인식 상태 [S, L]</span>
                <span className="font-semibold text-slate-200">
                  {lastResult?.builder_state
                    ? `[성공률:${lastResult.builder_state[0]}, 경로:${lastResult.builder_state[1]}]`
                    : "없음"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 미로 제작 AI Q-Table 히트맵 (상태 9개 × 행동 4개) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <Layers className="h-3 w-3 text-violet-400" />
              SARSA 9×4 Q-Table 매트릭스
            </span>
            <span className="text-[10px] text-slate-500">
              {qTable ? "강화학습 Q값 히트맵" : "규칙 기반 모드 (테이블 미사용)"}
            </span>
          </div>

          {qTable === null ? (
            <div className="rounded border border-[#1b283d] bg-[#090e18] px-3 py-4 text-center font-mono text-xs text-slate-500">
              {builderMode === "rule"
                ? "규칙 기반 미로 제작 AI는 고정 휴리스틱 규칙으로 동작합니다."
                : "최소 1라운드를 실행하면 SARSA 학습 가중치 매트릭스가 표시됩니다."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-[#1b283d] bg-[#090e18]">
              <table className="w-full border-collapse font-mono text-[10.5px] tabular-nums">
                <thead>
                  <tr className="border-b border-[#1b283d] bg-[#0d1524] text-[9.5px] text-slate-400">
                    <th className="whitespace-nowrap px-2 py-1.5 text-left">상태 [성공률/경로]</th>
                    {ACTION_COLUMNS.map((act) => (
                      <th key={act} className="whitespace-nowrap px-2 py-1.5 text-right">
                        {getBuilderActionLabel(act)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#172338]">
                  {qTable.flatMap((rateSlice, rIdx) =>
                    rateSlice.map((actionVals, pIdx) => {
                      const isActiveState =
                        lastResult?.builder_state?.[0] === rIdx &&
                        lastResult?.builder_state?.[1] === pIdx;
                      return (
                        <tr
                          key={`qrow-${rIdx}-${pIdx}`}
                          className={isActiveState ? "bg-violet-950/40" : "hover:bg-[#0c1424]"}
                        >
                          <td className="whitespace-nowrap px-2 py-1 text-slate-300">
                            <span
                              className={
                                isActiveState
                                  ? "font-bold text-violet-300 drop-shadow-[0_0_4px_rgba(167,139,250,0.5)]"
                                  : ""
                              }
                            >
                              ({rIdx},{pIdx}) {RATE_LABELS[rIdx].slice(4)}/{PATH_LABELS[pIdx].slice(3)}
                            </span>
                          </td>
                          {actionVals.map((val, aIdx) => {
                            const isSelectedCell =
                              isActiveState && lastResult?.builder_action === aIdx;
                            return (
                              <td
                                key={`qcell-${rIdx}-${pIdx}-${aIdx}`}
                                className={`px-2 py-1 text-right text-slate-100 ${
                                  isSelectedCell
                                    ? "font-extrabold ring-2 ring-inset ring-violet-400 bg-violet-700/50"
                                    : ""
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
          <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <History className="h-3 w-3 text-slate-400" />
              미로 수정 타임라인 로그
            </span>
            <span className="text-[10px] text-slate-500">최근 {recentLogs.length}건 기록</span>
          </div>

          <div className="overflow-x-auto rounded border border-[#1b283d] bg-[#090e18]">
            {recentLogs.length === 0 ? (
              <div className="py-3 text-center font-mono text-xs text-slate-600">
                수정 이력이 아직 없습니다.
              </div>
            ) : (
              <table className="w-full border-collapse font-mono text-[10.5px] tabular-nums">
                <thead>
                  <tr className="border-b border-[#1b283d] bg-[#0d1524] text-[9.5px] text-slate-400">
                    <th className="px-2 py-1.5 text-left">라운드</th>
                    <th className="px-2 py-1.5 text-left">선택 행동</th>
                    <th className="px-2 py-1.5 text-left">수정 내용</th>
                    <th className="px-2 py-1.5 text-right">보상</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#172338]">
                  {recentLogs.map((entry, idx) => (
                    <tr key={`edit-log-${entry.round}-${idx}`} className="hover:bg-[#0c1424]">
                      <td className="px-2 py-1 text-slate-400">라운드 {entry.round}</td>
                      <td className="px-2 py-1 text-violet-300">
                        {getBuilderActionLabel(entry.builder_action_name)}
                      </td>
                      <td className="px-2 py-1 text-slate-200">
                        <span className="mr-1.5 font-medium">
                          {formatEditTarget(entry.edit)}
                        </span>
                        {entry.edit_reverted ? (
                          <span className="rounded bg-rose-950/80 px-1 py-0.5 text-[9px] text-rose-300">
                            되돌림
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-950/80 px-1 py-0.5 text-[9px] text-emerald-300">
                            적용
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-2 py-1 text-right font-semibold ${
                          entry.builder_reward >= 0 ? "text-emerald-300" : "text-rose-300"
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
