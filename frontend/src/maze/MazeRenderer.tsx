import { useMemo } from "react";
import type { Coord, MazeEdit, OverlayMode } from "../types/simulation";
import { AgentRenderer } from "./AgentRenderer";

interface MazeRendererProps {
  grid: number[][];
  start: Coord;
  goal: Coord;
  prevGrid: number[][] | null;
  edit: MazeEdit | null;
  editReverted: boolean;
  qPath: Coord[];
  qHeatmap: number[][] | null;
  visitCounts: number[][] | null;
  overlayMode: OverlayMode;
  stepIndex: number;
  showPath: boolean;
  hoveredCell: Coord | null;
  onHoverCell: (coord: Coord | null) => void;
}

const VIEWPORT_GRID_SIZE = 440;
const AXIS_MARGIN = 26;

function interpolateHeatmapColor(norm: number, mode: OverlayMode): string {
  const t = Math.max(0, Math.min(1, norm));
  if (mode === "q_heatmap") {
    const r = Math.round(14 + t * 24);
    const g = Math.round(28 + t * 135);
    const b = Math.round(52 + t * 168);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const r = Math.round(14 + t * 12);
  const g = Math.round(32 + t * 126);
  const b = Math.round(42 + t * 84);
  return `rgb(${r}, ${g}, ${b})`;
}

export function MazeRenderer({
  grid,
  start,
  goal,
  prevGrid,
  edit,
  editReverted,
  qPath,
  qHeatmap,
  visitCounts,
  overlayMode,
  stepIndex,
  showPath,
  hoveredCell,
  onHoverCell,
}: MazeRendererProps) {
  const size = grid.length || 5;
  const cellSize = VIEWPORT_GRID_SIZE / size;
  const totalViewBox = VIEWPORT_GRID_SIZE + AXIS_MARGIN + 10;

  const activeMatrix = useMemo(() => {
    if (overlayMode === "q_heatmap") return qHeatmap;
    if (overlayMode === "visits") return visitCounts;
    return null;
  }, [overlayMode, qHeatmap, visitCounts]);

  const { minVal, maxVal } = useMemo(() => {
    if (!activeMatrix || activeMatrix.length !== size) return { minVal: 0, maxVal: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (grid[r]?.[c] === 1) continue;
        const v = activeMatrix[r]?.[c];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
      return { minVal: 0, maxVal: 1 };
    }
    return { minVal: min, maxVal: max };
  }, [activeMatrix, grid, size]);

  const badgeSize = Math.max(15, Math.min(24, cellSize * 0.34));
  const axisFontSize = size >= 10 ? 9.5 : 10.5;

  return (
    <svg
      viewBox={`0 0 ${totalViewBox} ${totalViewBox}`}
      className="h-auto w-full max-w-[540px] select-none"
      role="img"
      aria-label={`${size}x${size} AI Maze Evolution grid`}
      onMouseLeave={() => onHoverCell(null)}
    >
      <defs>
        <pattern
          id="wall-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="#334766" strokeWidth="1.5" />
        </pattern>
      </defs>

      {/* Column axis indices */}
      {Array.from({ length: size }, (_, col) => (
        <text
          key={`col-${col}`}
          x={AXIS_MARGIN + col * cellSize + cellSize / 2}
          y={15}
          textAnchor="middle"
          fill="#64748b"
          fontSize={axisFontSize}
          fontFamily="JetBrains Mono, monospace"
        >
          {col}
        </text>
      ))}

      {/* Row axis indices */}
      {Array.from({ length: size }, (_, row) => (
        <text
          key={`row-${row}`}
          x={13}
          y={AXIS_MARGIN + row * cellSize + cellSize / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#64748b"
          fontSize={axisFontSize}
          fontFamily="JetBrains Mono, monospace"
        >
          {row}
        </text>
      ))}

      {/* Outer maze frame */}
      <rect
        x={AXIS_MARGIN - 1}
        y={AXIS_MARGIN - 1}
        width={VIEWPORT_GRID_SIZE + 2}
        height={VIEWPORT_GRID_SIZE + 2}
        fill="#0b1220"
        stroke="#2c3e5a"
        strokeWidth={1.5}
        rx={3}
      />

      {/* Grid cells */}
      {grid.map((rowArr, r) =>
        rowArr.map((cell, c) => {
          const x = AXIS_MARGIN + c * cellSize;
          const y = AXIS_MARGIN + r * cellSize;
          const isWall = cell === 1;
          const isStart = r === start[0] && c === start[1];
          const isGoal = r === goal[0] && c === goal[1];
          const isHovered = hoveredCell?.[0] === r && hoveredCell?.[1] === c;
          const changedFromPrev =
            prevGrid !== null &&
            prevGrid.length === size &&
            prevGrid[r]?.[c] !== undefined &&
            prevGrid[r][c] !== cell;

          let fill = isWall ? "#1e2c42" : "#0e1726";
          if (
            !isWall &&
            activeMatrix &&
            activeMatrix.length === size &&
            activeMatrix[r]?.[c] !== undefined
          ) {
            const norm = (activeMatrix[r][c] - minVal) / (maxVal - minVal);
            fill = interpolateHeatmapColor(norm, overlayMode);
          }

          return (
            <g
              key={`${r}-${c}`}
              onMouseEnter={() => onHoverCell([r, c])}
              className="cursor-crosshair"
            >
              <rect
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={fill}
                stroke={isHovered ? "#94a3b8" : "#1a263b"}
                strokeWidth={isHovered ? 1.5 : 0.8}
              />

              {isWall && (
                <>
                  <rect
                    x={x + 1.5}
                    y={y + 1.5}
                    width={Math.max(2, cellSize - 3)}
                    height={Math.max(2, cellSize - 3)}
                    fill="url(#wall-hatch)"
                    opacity={0.75}
                  />
                  <rect
                    x={x + 1.5}
                    y={y + 1.5}
                    width={Math.max(2, cellSize - 3)}
                    height={Math.max(2, cellSize - 3)}
                    fill="none"
                    stroke="#384d6e"
                    strokeWidth={0.8}
                    rx={1.5}
                  />
                </>
              )}

              {changedFromPrev && (
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={cellSize - 4}
                  height={cellSize - 4}
                  fill="#a78bfa"
                  fillOpacity={0.14}
                />
              )}

              {!isWall &&
                activeMatrix &&
                activeMatrix.length === size &&
                size <= 7 &&
                !isStart &&
                !isGoal &&
                activeMatrix[r]?.[c] !== undefined && (
                  <text
                    x={x + cellSize - 4}
                    y={y + cellSize - 4}
                    textAnchor="end"
                    fill="#e2e8f0"
                    fillOpacity={0.72}
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                    className="pointer-events-none"
                  >
                    {overlayMode === "visits"
                      ? activeMatrix[r][c]
                      : activeMatrix[r][c].toFixed(0)}
                  </text>
                )}

              {isStart && (
                <g className="pointer-events-none">
                  <rect
                    x={x + 4}
                    y={y + 4}
                    width={badgeSize}
                    height={badgeSize}
                    rx={2.5}
                    fill="#064e3b"
                    stroke="#10b981"
                    strokeWidth={1.2}
                  />
                  <text
                    x={x + 4 + badgeSize / 2}
                    y={y + 4 + badgeSize / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#6ee7b7"
                    fontSize={Math.max(9, badgeSize * 0.52)}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    S
                  </text>
                </g>
              )}

              {isGoal && (
                <g className="pointer-events-none">
                  <rect
                    x={x + cellSize - badgeSize - 4}
                    y={y + cellSize - badgeSize - 4}
                    width={badgeSize}
                    height={badgeSize}
                    rx={2.5}
                    fill="#115e59"
                    stroke="#2dd4bf"
                    strokeWidth={1.2}
                  />
                  <text
                    x={x + cellSize - badgeSize / 2 - 4}
                    y={y + cellSize - badgeSize / 2 - 4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#99f6e4"
                    fontSize={Math.max(9, badgeSize * 0.52)}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    G
                  </text>
                </g>
              )}
            </g>
          );
        }),
      )}

      {/* Builder AI Edit Highlight */}
      {edit &&
        edit.pos[0] >= 0 &&
        edit.pos[0] < size &&
        edit.pos[1] >= 0 &&
        edit.pos[1] < size && (
          <g className="pointer-events-none">
            <rect
              x={AXIS_MARGIN + edit.pos[1] * cellSize + 2.5}
              y={AXIS_MARGIN + edit.pos[0] * cellSize + 2.5}
              width={cellSize - 5}
              height={cellSize - 5}
              fill="none"
              stroke={editReverted ? "#f43f5e" : "#a78bfa"}
              strokeWidth={2.4}
              strokeDasharray={editReverted ? "5 3" : undefined}
              rx={2}
              className="maze-edit-pulse"
            />
            <rect
              x={AXIS_MARGIN + edit.pos[1] * cellSize + 3}
              y={AXIS_MARGIN + edit.pos[0] * cellSize + 3}
              width={Math.min(cellSize - 6, 30)}
              height={13}
              rx={1.5}
              fill={editReverted ? "#881337" : "#4c1d95"}
            />
            <text
              x={AXIS_MARGIN + edit.pos[1] * cellSize + 3 + Math.min(cellSize - 6, 30) / 2}
              y={AXIS_MARGIN + edit.pos[0] * cellSize + 9.8}
              textAnchor="middle"
              dominantBaseline="central"
              fill={editReverted ? "#fecdd3" : "#ede9fe"}
              fontSize={8}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              {editReverted ? "REV" : edit.type === "add_wall" ? "+W" : "-W"}
            </text>
          </g>
        )}

      {/* Single Q-Learning Solver Path & Token */}
      <AgentRenderer
        qPath={qPath}
        stepIndex={stepIndex}
        cellSize={cellSize}
        originOffset={AXIS_MARGIN}
        showPath={showPath}
      />
    </svg>
  );
}
