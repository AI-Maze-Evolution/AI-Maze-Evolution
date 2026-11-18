import type { Coord } from "../types/simulation";

interface AgentRendererProps {
  qPath: Coord[];
  stepIndex: number;
  cellSize: number;
  originOffset: number;
  showPath: boolean;
}

function buildPolylinePoints(
  path: Coord[],
  cellSize: number,
  originOffset: number,
): string {
  return path
    .map(([row, col]) => {
      const x = originOffset + col * cellSize + cellSize / 2;
      const y = originOffset + row * cellSize + cellSize / 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function AgentRenderer({
  qPath,
  stepIndex,
  cellSize,
  originOffset,
  showPath,
}: AgentRendererProps) {
  if (!showPath || qPath.length === 0) return null;

  const strokeWidth = Math.max(2.2, Math.min(3.8, cellSize * 0.065));
  const tokenRadius = Math.max(7, Math.min(14, cellSize * 0.24));
  const fontSize = Math.max(8.5, Math.min(12, tokenRadius * 0.95));

  const clampedIdx = Math.min(stepIndex, qPath.length - 1);
  const pos = qPath[clampedIdx];
  const activeTrail = qPath.slice(0, clampedIdx + 1);

  return (
    <g className="pointer-events-none">
      {/* Full greedy trajectory guide */}
      {qPath.length > 1 && (
        <polyline
          points={buildPolylinePoints(qPath, cellSize, originOffset)}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={strokeWidth}
          strokeOpacity={0.28}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Active animated trail up to current playback step */}
      {activeTrail.length > 1 && (
        <polyline
          points={buildPolylinePoints(activeTrail, cellSize, originOffset)}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={strokeWidth * 1.15}
          strokeOpacity={0.95}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Q-Learning Solver Agent Token */}
      <g
        className="agent-token-move"
        style={{
          transform: `translate(${originOffset + pos[1] * cellSize + cellSize / 2}px, ${
            originOffset + pos[0] * cellSize + cellSize / 2
          }px)`,
        }}
      >
        <circle r={tokenRadius + 3.5} fill="#38bdf8" fillOpacity={0.2} />
        <circle
          r={tokenRadius}
          fill="#0284c7"
          stroke="#e0f2fe"
          strokeWidth={1.6}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight={700}
          fontFamily="JetBrains Mono, monospace"
        >
          Q
        </text>
      </g>
    </g>
  );
}
