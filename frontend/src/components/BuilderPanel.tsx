import {
  BUILDER_ACTION_LABELS,
  type BuilderActionName,
  type BuilderMode,
  type EditHistoryEntry,
  type MazeEdit,
  type RoundResult,
} from "../types/simulation";

interface BuilderPanelProps {
  builderMode: BuilderMode;
  lastResult: RoundResult | null;
  currentGrid: number[][];
  prevGrid: number[][] | null;
  editHistory: EditHistoryEntry[];
  era: number;
  eraSizes: number[];
}

const RATE_LABELS = ["Low (<30%)", "Mid (30-70%)", "High (>70%)"];
const PATH_LABELS = ["Short", "Mid", "Long"];
const ACTION_COLUMNS: BuilderActionName[] = [
  "block_hot",
  "block_path",
  "random_wall",
  "remove_wall",
];

function MiniMazeSvg({
  grid,
  highlightPos,
  highlightColor,
  label,
}: {
  grid: number[][] | null;
  highlightPos: [number, number] | null;
  highlightColor: string;
  label: string;
}) {
  if (!grid || grid.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-lab-border bg-lab-bg p-2">
        <span className="font-mono text-[10px] uppercase text-slate-500">{label}</span>
        <div className="flex h-[78px] w-[78px] items-center justify-center font-mono text-[10px] text-slate-600">
          N/A
        </div>
      </div>
    );
  }

  const size = grid.length;
  const view = 78;
  const cell = view / size;

  return (
    <div className="flex flex-col items-center border border-lab-border bg-lab-bg p-2">
      <span className="mb-1 font-mono text-[10px] uppercase text-slate-400">{label}</span>
      <svg viewBox={`0 0 ${view} ${view}`} className="h-[78px] w-[78px]">
        {grid.map((rowArr, r) =>
          rowArr.map((val, c) => (
            <rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell}
              height={cell}
              fill={val === 1 ? "#334766" : "#0e1726"}
              stroke="#1a263b"
              strokeWidth={0.6}
            />
          )),
        )}
        {highlightPos && highlightPos[0] < size && highlightPos[1] < size && (
          <rect
            x={highlightPos[1] * cell + 0.8}
            y={highlightPos[0] * cell + 0.8}
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

function formatEditLabel(edit: MazeEdit | null, editType?: string | null): string {
  if (edit) {
    const tag =
      edit.type === "add_wall"
        ? "+WALL"
        : edit.type === "remove_wall"
          ? "-WALL"
          : edit.type.toUpperCase();
    return `${tag} (${edit.pos[0]},${edit.pos[1]})`;
  }
  if (editType) return editType;
  return "No edit";
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
  prevGrid,
  editHistory,
  era,
  eraSizes,
}: BuilderPanelProps) {
  const proposedEdits = editHistory.filter((e) => e.edit !== null || e.edit_type !== null);
  const appliedCount = proposedEdits.filter((e) => !e.edit_reverted).length;
  const revertedCount = proposedEdits.filter((e) => e.edit_reverted).length;

  // 1-based Era indexing: era 1 -> eraSizes[0], next era -> eraSizes[era]
  const nextEraSize =
    lastResult?.next_size ?? (era < eraSizes.length ? eraSizes[era] : null);
  const afterGrid = lastResult ? lastResult.grid : currentGrid;
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

  return (
    <section className="border border-lab-border border-l-2 border-l-violet-400 bg-lab-surface">
      <div className="flex items-center justify-between border-b border-lab-border px-3 py-2">
        <div>
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-violet-300">
            Maze Builder AI · {builderMode === "sarsa" ? "SARSA" : "Rule-Based"}
          </h2>
          <p className="text-[11px] text-slate-500">
            Maze modification policy, 9×4 Q-table heatmap &amp; diff log
          </p>
        </div>
        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
          Next Era: {nextEraSize ? `${nextEraSize}×${nextEraSize}` : "FINAL"}
        </span>
      </div>

      <div className="space-y-3 p-3">
        {/* Builder KPIs */}
        <div className="grid grid-cols-4 gap-2 font-mono text-xs tabular-nums">
          <div className="border border-lab-border bg-lab-bg px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-500">Applied</div>
            <div className="font-semibold text-violet-300">{appliedCount}</div>
          </div>
          <div className="border border-lab-border bg-lab-bg px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-500">Reverted</div>
            <div className="font-semibold text-rose-400">{revertedCount}</div>
          </div>
          <div className="border border-lab-border bg-lab-bg px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-500">Reward</div>
            <div
              className={`font-semibold ${
                (lastResult?.builder_reward ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {lastResult ? lastResult.builder_reward.toFixed(2) : "—"}
            </div>
          </div>
          <div className="border border-lab-border bg-lab-bg px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-500">Action</div>
            <div className="truncate text-[11px] font-semibold text-violet-200">
              {lastResult?.builder_action_name ?? "—"}
            </div>
          </div>
        </div>

        {/* Before / After Mini Maze Diff */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
          <div className="grid grid-cols-2 gap-2">
            <MiniMazeSvg
              grid={prevGrid}
              highlightPos={latestEdit ? latestEdit.pos : null}
              highlightColor={highlightColor}
              label="Before"
            />
            <MiniMazeSvg
              grid={afterGrid}
              highlightPos={latestEdit ? latestEdit.pos : null}
              highlightColor={highlightColor}
              label="After"
            />
          </div>

          <div className="flex flex-col justify-between border border-lab-border bg-lab-bg p-2.5 font-mono text-[11px]">
            <div>
              <div className="text-[9px] uppercase text-slate-500">Latest Modification</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-100">
                  {formatEditLabel(latestEdit)}
                </span>
                {latestEdit && (
                  <span
                    className={`border px-1 text-[9px] font-semibold ${
                      lastResult?.edit_reverted
                        ? "border-rose-700 bg-rose-950/70 text-rose-300"
                        : "border-violet-700 bg-violet-950/70 text-violet-200"
                    }`}
                  >
                    {lastResult?.edit_reverted ? "REVERTED" : "APPLIED"}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-1 border-t border-lab-border pt-2 text-[10px] text-slate-400">
              <div className="flex justify-between">
                <span>Action Name</span>
                <span className="text-violet-300">
                  {lastResult?.builder_action_name
                    ? `${lastResult.builder_action} · ${BUILDER_ACTION_LABELS[lastResult.builder_action_name]}`
                    : "none"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Builder State</span>
                <span className="text-slate-200">
                  {lastResult?.builder_state
                    ? `[${lastResult.builder_state[0]}, ${lastResult.builder_state[1]}]`
                    : "null"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Round Grid</span>
                <span className="text-sky-300">
                  {afterGrid.length}×{afterGrid.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Builder Q-Table Heatmap (9 States × 4 Actions) */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-500">
            <span>Builder Q-Table (3×3 States × 4 Actions)</span>
            <span>{qTable ? "SARSA Online Q" : "Rule Mode · No Q-Table"}</span>
          </div>

          {qTable === null ? (
            <div className="border border-lab-border bg-lab-bg px-3 py-3 text-center font-mono text-[11px] text-slate-500">
              {builderMode === "rule"
                ? "Rule-Based Builder does not maintain a Q-table (builder_q_table: null)."
                : "Run at least 1 round to inspect SARSA Builder Q-table values."}
            </div>
          ) : (
            <div className="overflow-x-auto border border-lab-border bg-lab-bg">
              <table className="w-full border-collapse font-mono text-[10px] tabular-nums">
                <thead>
                  <tr className="border-b border-lab-border bg-lab-surface text-[9px] uppercase text-slate-400">
                    <th className="px-1.5 py-1 text-left">State (Rate / Path)</th>
                    {ACTION_COLUMNS.map((act) => (
                      <th key={act} className="px-1.5 py-1 text-right">
                        {act}
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
                              ({rIdx},{pIdx}) {RATE_LABELS[rIdx]?.split(" ")[0]}/{PATH_LABELS[pIdx]}
                            </span>
                          </td>
                          {actionVals.map((val, aIdx) => {
                            const isSelectedCell =
                              isActiveState && lastResult?.builder_action === aIdx;
                            return (
                              <td
                                key={`qcell-${rIdx}-${pIdx}-${aIdx}`}
                                className={`px-1.5 py-1 text-right text-slate-100 ${
                                  isSelectedCell ? "ring-1 ring-inset ring-violet-300 font-bold" : ""
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

        {/* Edit History Log */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-500">
            <span>Modification History</span>
            <span className="tabular-nums">{editHistory.length} rounds logged</span>
          </div>
          <div className="max-h-[130px] overflow-y-auto border border-lab-border bg-lab-bg font-mono text-[11px] tabular-nums">
            {recentLogs.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-slate-500">
                No maze modifications yet. Press START or STEP.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 border-b border-lab-border bg-lab-surface text-[9px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Rnd</th>
                    <th className="px-2 py-1">Action</th>
                    <th className="px-2 py-1">Edit</th>
                    <th className="px-2 py-1 text-right">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lab-border/60">
                  {recentLogs.map((entry) => (
                    <tr key={`edit-r-${entry.round}`} className="hover:bg-slate-800/40">
                      <td className="px-2 py-1 text-slate-400">R{entry.round}</td>
                      <td className="px-2 py-1 text-violet-300">
                        {entry.builder_action_name ?? "—"}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={
                            entry.edit_reverted
                              ? "text-rose-400 line-through"
                              : entry.edit || entry.edit_type
                                ? "text-slate-200"
                                : "text-slate-500"
                          }
                        >
                          {formatEditLabel(entry.edit, entry.edit_type)}
                        </span>
                      </td>
                      <td
                        className={`px-2 py-1 text-right font-semibold ${
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
