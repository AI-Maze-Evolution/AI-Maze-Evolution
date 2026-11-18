import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getBuilderActionLabel, type HistoryItem } from "../types/simulation";

interface BuilderChartProps {
  history: HistoryItem[];
  eraTransitions: number[];
}

const DEFAULT_ACTIONS = ["block_hot", "block_path", "move_to_path", "move_to_hot"];

export function BuilderChart({ history, eraTransitions }: BuilderChartProps) {
  const data = history.map((pt) => ({
    round: pt.round,
    reward: Number(pt.builder_reward.toFixed(3)),
    revertedPoint: pt.edit_reverted ? Number(pt.builder_reward.toFixed(3)) : null,
    action: getBuilderActionLabel(pt.builder_action_name),
  }));

  const observedActions = Array.from(
    new Set(
      history
        .map((item) => item.builder_action_name)
        .filter((name): name is string => Boolean(name)),
    ),
  );
  const actionKeys = observedActions.length > 0 ? observedActions : DEFAULT_ACTIONS;

  const actionCounts = actionKeys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = history.filter((item) => item.builder_action_name === key).length;
    return acc;
  }, {});

  return (
    <section className="flex flex-col border border-lab-border bg-lab-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lab-border px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-200">
            미로 제작 AI 보상 및 행동 분포
          </h3>
          <p className="text-[11px] text-slate-500">
            SARSA / 규칙 기반 제작 AI의 보상 변화와 행동 선택 기록
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] tabular-nums">
          {actionKeys.map((key) => (
            <span
              key={key}
              className="whitespace-nowrap border border-lab-border bg-lab-bg px-1.5 py-0.5 text-slate-300"
            >
              <span className="text-violet-300">{getBuilderActionLabel(key)}</span>:{" "}
              {actionCounts[key]}회
            </span>
          ))}
        </div>
      </div>

      <div className="h-[220px] w-full p-2.5">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
            표시할 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="builderRewardFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1a263b" strokeDasharray="3 3" />
              <XAxis
                dataKey="round"
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                stroke="#223047"
              />
              <YAxis
                domain={[-1.2, 1.4]}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                stroke="#223047"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1220",
                  border: "1px solid #2c3e5a",
                  borderRadius: "3px",
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono, Noto Sans KR, sans-serif",
                }}
                labelFormatter={(label) => `라운드 ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />
              <ReferenceLine y={0} stroke="#475569" />
              {eraTransitions.map((roundNum, idx) => (
                <ReferenceLine
                  key={`era-${roundNum}`}
                  x={roundNum}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  label={{
                    value: `시대 ${idx + 2}`,
                    position: "insideTopRight",
                    fill: "#94a3b8",
                    fontSize: 9,
                  }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="reward"
                name="미로 제작 AI 보상"
                stroke="#a78bfa"
                strokeWidth={2}
                fill="url(#builderRewardFill)"
                isAnimationActive={false}
              />
              <Scatter
                dataKey="revertedPoint"
                name="되돌린 수정"
                fill="#f43f5e"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
