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

  const strokeWidth = Math.max(2.4, Math.min(4.2, cellSize * 0.075));
  const tokenRadius = Math.max(8, Math.min(15, cellSize * 0.25));
  const fontSize = Math.max(9, Math.min(12, tokenRadius * 0.95));

  const clampedIdx = Math.min(stepIndex, qPath.length - 1);
  const pos = qPath[clampedIdx];
  const activeTrail = qPath.slice(0, clampedIdx + 1);

  return (
    <g className="pointer-events-none">
      {/* 전체 탐색 궤적 가이드 (반투명 사이안 라인) */}
      {qPath.length > 1 && (
        <polyline
          points={buildPolylinePoints(qPath, cellSize, originOffset)}
          fill="none"
          stroke="#0284c7"
          strokeWidth={strokeWidth}
          strokeOpacity={0.35}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* 현재 재생 스텝까지의 활성 주행선 (빛나는 네온 사이안) */}
      {activeTrail.length > 1 && (
        <>
          {/* 외곽 네온 글로우 */}
          <polyline
            points={buildPolylinePoints(activeTrail, cellSize, originOffset)}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={strokeWidth * 1.8}
            strokeOpacity={0.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 코어 라인 */}
          <polyline
            points={buildPolylinePoints(activeTrail, cellSize, originOffset)}
            fill="none"
            stroke="#7dd3fc"
            strokeWidth={strokeWidth}
            strokeOpacity={0.95}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Q-Learning Solver 에이전트 토큰 */}
      <g
        className="agent-token-move"
        style={{
          transform: `translate(${originOffset + pos[1] * cellSize + cellSize / 2}px, ${
            originOffset + pos[0] * cellSize + cellSize / 2
          }px)`,
        }}
      >
        {/* 외곽 레이더 펄스 링 */}
        <circle
          r={tokenRadius + 5}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1}
          strokeOpacity={0.4}
        />
        <circle r={tokenRadius + 2.5} fill="#38bdf8" fillOpacity={0.22} />
        {/* 본체 원형 */}
        <circle
          r={tokenRadius}
          fill="#0284c7"
          stroke="#e0f2fe"
          strokeWidth={1.8}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight={800}
          fontFamily="JetBrains Mono, monospace"
        >
          Q
        </text>
      </g>
    </g>
  );
}
