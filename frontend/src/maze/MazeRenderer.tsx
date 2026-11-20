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

const VIEWPORT_GRID_SIZE = 560;
const AXIS_MARGIN = 28;

function interpolateHeatmapColor(norm: number, mode: OverlayMode): string {
  const t = Math.max(0, Math.min(1, norm));
  if (mode === "q_heatmap") {
    const r = Math.round(12 + t * 38);
    const g = Math.round(24 + t * 155);
    const b = Math.round(46 + t * 195);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const r = Math.round(10 + t * 12);
  const g = Math.round(28 + t * 135);
  const b = Math.round(36 + t * 96);
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

  const badgeSize = Math.max(18, Math.min(32, cellSize * 0.42));
  const axisFontSize = size >= 10 ? 11 : 12;
  const edgeStrokeWidth = Math.max(4.5, Math.min(8.5, cellSize * 0.13));

  return (
    <svg
      viewBox={`0 0 ${totalViewBox} ${totalViewBox}`}
      className="h-auto w-full max-w-[680px] select-none drop-shadow-[0_12px_32px_rgba(0,0,0,0.65)]"
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
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 열 인덱스 (X축) */}
      {Array.from({ length: size }, (_, col) => (
        <text
          key={`col-${col}`}
          x={AXIS_MARGIN + col * cellSize + cellSize / 2}
          y={17}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={axisFontSize}
          fontWeight={700}
          fontFamily="JetBrains Mono, monospace"
        >
          {col}
        </text>
      ))}

      {/* 행 인덱스 (Y축) */}
      {Array.from({ length: size }, (_, row) => (
        <text
          key={`row-${row}`}
          x={14}
          y={AXIS_MARGIN + row * cellSize + cellSize / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#94a3b8"
          fontSize={axisFontSize}
          fontWeight={700}
          fontFamily="JetBrains Mono, monospace"
        >
          {row}
        </text>
      ))}

      {/* 챔버 외곽 정밀 테두리 */}
      <rect
        x={AXIS_MARGIN - 1}
        y={AXIS_MARGIN - 1}
        width={VIEWPORT_GRID_SIZE + 2}
        height={VIEWPORT_GRID_SIZE + 2}
        fill="#080e18"
        stroke="#233550"
        strokeWidth={2}
        rx={4}
      />

      {/* 격자 칸 렌더링 */}
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

          let fill = isCellWall ? "#1c283c" : "#0c1322";
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
                stroke={isHovered ? "#38bdf8" : "#172337"}
                strokeWidth={isHovered ? 1.6 : 0.8}
              />

              {isCellWall && (
                <>
                  <rect
                    x={x + 1.5}
                    y={y + 1.5}
                    width={Math.max(2, cellSize - 3)}
                    height={Math.max(2, cellSize - 3)}
                    fill="url(#wall-hatch)"
                    opacity={0.8}
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
                  fillOpacity={0.16}
                />
              )}

              {/* 히트맵 수치 레이블 (소형 격자용) */}
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
                    fillOpacity={0.78}
                    fontSize={9}
                    fontWeight={600}
                    fontFamily="JetBrains Mono, monospace"
                    className="pointer-events-none"
                  >
                    {overlayMode === "visits"
                      ? activeMatrix[r][c]
                      : activeMatrix[r][c].toFixed(0)}
                  </text>
                )}

              {/* 출발지 (Start: S) */}
              {isStart && (
                <g className="pointer-events-none">
                  <rect
                    x={x + 4}
                    y={y + 4}
                    width={badgeSize}
                    height={badgeSize}
                    rx={3}
                    fill="#065f46"
                    stroke="#10b981"
                    strokeWidth={1.4}
                  />
                  <text
                    x={x + 4 + badgeSize / 2}
                    y={y + 4 + badgeSize / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#a7f3d0"
                    fontSize={Math.max(10, badgeSize * 0.54)}
                    fontWeight={800}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    S
                  </text>
                </g>
              )}

              {/* 목적지 (Goal: G) */}
              {isGoal && (
                <g className="pointer-events-none">
                  <rect
                    x={x + cellSize - badgeSize - 4}
                    y={y + cellSize - badgeSize - 4}
                    width={badgeSize}
                    height={badgeSize}
                    rx={3}
                    fill="#0f766e"
                    stroke="#2dd4bf"
                    strokeWidth={1.4}
                  />
                  <text
                    x={x + cellSize - badgeSize / 2 - 4}
                    y={y + cellSize - badgeSize / 2 - 4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ccfbf1"
                    fontSize={Math.max(10, badgeSize * 0.54)}
                    fontWeight={800}
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
                strokeWidth={Math.max(2, edgeStrokeWidth * 0.6)}
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
                {/* 외곽 고대비 윤곽선 */}
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke="#05080e"
                  strokeWidth={edgeStrokeWidth + 2.5}
                  strokeLinecap="round"
                />
                {/* 벽 본체 */}
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={isNewlyAdded ? "#a78bfa" : "#e2e8f0"}
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
                  strokeWidth={edgeStrokeWidth * 0.8}
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
                  strokeWidth={edgeStrokeWidth + 1.8}
                  strokeDasharray={editReverted ? "5 3" : undefined}
                  strokeLinecap="round"
                  className="maze-edit-pulse"
                />
                <circle
                  cx={tSeg.midX}
                  cy={tSeg.midY}
                  r={4.5}
                  fill={editReverted ? "#f43f5e" : "#a78bfa"}
                  stroke="#070b12"
                  strokeWidth={1.4}
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
              rx={2}
              fill={editReverted ? "#881337" : "#4c1d95"}
            />
            <text
              x={AXIS_MARGIN + targetCell[1] * cellSize + 3 + Math.min(cellSize - 6, 32) / 2}
              y={AXIS_MARGIN + targetCell[0] * cellSize + 9.8}
              textAnchor="middle"
              dominantBaseline="central"
              fill={editReverted ? "#fecdd3" : "#ede9fe"}
              fontSize={8.5}
              fontWeight={800}
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

      {/* Q-Learning 탈출 AI 경로 및 에이전트 토큰 */}
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
