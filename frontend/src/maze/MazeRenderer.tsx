import { useMemo } from "react";
import type { Coord, MazeEdit, OverlayMode } from "../types/simulation";
import { AgentRenderer } from "./AgentRenderer";
import {
  edgeToSegment,
  extractEditEdges,
  parseEdgeWalls,
} from "./wallUtils";

interface MazeRendererProps {
  grid: number[][];
  walls?: unknown;
  start: Coord;
  goal: Coord;
  prevGrid: number[][] | null;
  prevWalls?: unknown;
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
  walls,
  start,
  goal,
  prevGrid,
  prevWalls,
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

  // 경계선 벽 데이터가 존재하면 칸 채우기 대신 이웃 두 칸 사이 경계선에 벽을 그린다.
  const edgeWalls = useMemo(() => parseEdgeWalls(walls), [walls]);
  const prevEdgeWalls = useMemo(() => parseEdgeWalls(prevWalls), [prevWalls]);
  const isEdgeWallMode = edgeWalls !== null;

  const prevEdgeKeys = useMemo(() => {
    if (!prevEdgeWalls) return new Set<string>();
    return new Set(prevEdgeWalls.map((e) => e.key));
  }, [prevEdgeWalls]);

  const currentEdgeKeys = useMemo(() => {
    if (!edgeWalls) return new Set<string>();
    return new Set(edgeWalls.map((e) => e.key));
  }, [edgeWalls]);

  const removedEdges = useMemo(() => {
    if (!prevEdgeWalls || !edgeWalls) return [];
    return prevEdgeWalls.filter((e) => !currentEdgeKeys.has(e.key));
  }, [prevEdgeWalls, edgeWalls, currentEdgeKeys]);

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
        if (!isEdgeWallMode && grid[r]?.[c] === 1) continue;
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
  }, [activeMatrix, grid, size, isEdgeWallMode]);

  const { targetEdge, fromEdge, targetCell, fromCell } = useMemo(
    () => extractEditEdges(edit),
    [edit],
  );

  const badgeSize = Math.max(15, Math.min(24, cellSize * 0.34));
  const axisFontSize = size >= 10 ? 9.5 : 10.5;
  const edgeStrokeWidth = Math.max(3.5, Math.min(6, cellSize * 0.1));

  return (
    <svg
      viewBox={`0 0 ${totalViewBox} ${totalViewBox}`}
      className="h-auto w-full max-w-[540px] select-none"
      role="img"
      aria-label={`${size}×${size} AI Maze Evolution 미로 격자`}
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

      {/* 열 인덱스 */}
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

      {/* 행 인덱스 */}
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

      {/* 외곽 테두리 */}
      <rect
        x={AXIS_MARGIN - 1}
        y={AXIS_MARGIN - 1}
        width={VIEWPORT_GRID_SIZE + 2}
        height={VIEWPORT_GRID_SIZE + 2}
        fill="#0b1220"
        stroke="#475569"
        strokeWidth={2}
        rx={3}
      />

      {/* 격자 칸 */}
      {grid.map((rowArr, r) =>
        rowArr.map((cell, c) => {
          const x = AXIS_MARGIN + c * cellSize;
          const y = AXIS_MARGIN + r * cellSize;
          const isCellWall = !isEdgeWallMode && cell === 1;
          const isStart = r === start[0] && c === start[1];
          const isGoal = r === goal[0] && c === goal[1];
          const isHovered = hoveredCell?.[0] === r && hoveredCell?.[1] === c;
          const changedFromPrev =
            !isEdgeWallMode &&
            prevGrid !== null &&
            prevGrid.length === size &&
            prevGrid[r]?.[c] !== undefined &&
            prevGrid[r][c] !== cell;

          let fill = isCellWall ? "#1e2c42" : "#0e1726";
          if (
            !isCellWall &&
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
                stroke={isHovered ? "#94a3b8" : "#182438"}
                strokeWidth={isHovered ? 1.5 : 0.8}
              />

              {isCellWall && (
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

              {!isCellWall &&
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

      {/* 경계선 벽 모드: 이웃한 두 칸 사이의 경계선에 양방향 차단 벽 표시 */}
      {isEdgeWallMode && (
        <g className="pointer-events-none">
          {/* 직전 라운드에서 제거/이동된 경계선 잔상 */}
          {removedEdges.map((edge) => {
            const seg = edgeToSegment(edge, cellSize, AXIS_MARGIN);
            return (
              <line
                key={`removed-${edge.key}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke="#64748b"
                strokeWidth={Math.max(2, edgeStrokeWidth * 0.55)}
                strokeDasharray="4 4"
                strokeOpacity={0.75}
                strokeLinecap="round"
              />
            );
          })}

          {/* 현재 경계선 벽 */}
          {edgeWalls.map((edge) => {
            const seg = edgeToSegment(edge, cellSize, AXIS_MARGIN);
            const isNewlyAdded = prevEdgeWalls !== null && !prevEdgeKeys.has(edge.key);
            return (
              <g key={`wall-${edge.key}`}>
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke="#090d14"
                  strokeWidth={edgeStrokeWidth + 2.4}
                  strokeLinecap="round"
                />
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={isNewlyAdded ? "#a78bfa" : "#cbd5e1"}
                  strokeWidth={edgeStrokeWidth}
                  strokeLinecap="round"
                  className={isNewlyAdded ? "maze-edit-pulse" : undefined}
                />
              </g>
            );
          })}
        </g>
      )}

      {/* 미로 제작 AI 수정 강조 (경계선 벽 edit 우선, 없으면 칸 edit) */}
      {edit && targetEdge && (
        <g className="pointer-events-none">
          {fromEdge && (
            (() => {
              const fSeg = edgeToSegment(fromEdge, cellSize, AXIS_MARGIN);
              return (
                <line
                  x1={fSeg.x1}
                  y1={fSeg.y1}
                  x2={fSeg.x2}
                  y2={fSeg.y2}
                  stroke="#f59e0b"
                  strokeWidth={edgeStrokeWidth * 0.75}
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
              );
            })()
          )}
          {(() => {
            const tSeg = edgeToSegment(targetEdge, cellSize, AXIS_MARGIN);
            return (
              <g>
                <line
                  x1={tSeg.x1}
                  y1={tSeg.y1}
                  x2={tSeg.x2}
                  y2={tSeg.y2}
                  stroke={editReverted ? "#f43f5e" : "#a78bfa"}
                  strokeWidth={edgeStrokeWidth + 1.5}
                  strokeDasharray={editReverted ? "5 3" : undefined}
                  strokeLinecap="round"
                  className="maze-edit-pulse"
                />
                <circle
                  cx={tSeg.midX}
                  cy={tSeg.midY}
                  r={4.2}
                  fill={editReverted ? "#f43f5e" : "#a78bfa"}
                  stroke="#090d14"
                  strokeWidth={1.2}
                />
              </g>
            );
          })()}
        </g>
      )}

      {edit && !targetEdge && targetCell &&
        targetCell[0] >= 0 &&
        targetCell[0] < size &&
        targetCell[1] >= 0 &&
        targetCell[1] < size && (
          <g className="pointer-events-none">
            {fromCell &&
              fromCell[0] >= 0 &&
              fromCell[0] < size &&
              fromCell[1] >= 0 &&
              fromCell[1] < size && (
                <rect
                  x={AXIS_MARGIN + fromCell[1] * cellSize + 3}
                  y={AXIS_MARGIN + fromCell[0] * cellSize + 3}
                  width={cellSize - 6}
                  height={cellSize - 6}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  rx={2}
                />
              )}
            <rect
              x={AXIS_MARGIN + targetCell[1] * cellSize + 2.5}
              y={AXIS_MARGIN + targetCell[0] * cellSize + 2.5}
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
              x={AXIS_MARGIN + targetCell[1] * cellSize + 3}
              y={AXIS_MARGIN + targetCell[0] * cellSize + 3}
              width={Math.min(cellSize - 6, 32)}
              height={13}
              rx={1.5}
              fill={editReverted ? "#881337" : "#4c1d95"}
            />
            <text
              x={AXIS_MARGIN + targetCell[1] * cellSize + 3 + Math.min(cellSize - 6, 32) / 2}
              y={AXIS_MARGIN + targetCell[0] * cellSize + 9.8}
              textAnchor="middle"
              dominantBaseline="central"
              fill={editReverted ? "#fecdd3" : "#ede9fe"}
              fontSize={8}
              fontWeight={700}
              fontFamily="JetBrains Mono, Noto Sans KR, monospace"
            >
              {editReverted
                ? "복구"
                : edit.type === "move_wall"
                  ? "이동"
                  : edit.type === "add_wall"
                    ? "+벽"
                    : "-벽"}
            </text>
          </g>
        )}

      {/* Q-Learning 탈출 AI 경로 및 에이전트 */}
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
