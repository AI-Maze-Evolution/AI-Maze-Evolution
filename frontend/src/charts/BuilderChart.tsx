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
    <section className="instrument-card flex flex-col overflow-hidden rounded-md shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b273b] bg-[#090e18] px-3.5 py-2.5">
        <div>
          <h3 className="font-mono text-xs font-bold text-slate-100">
            미로 제작 AI 보상 곡선 및 수정 거부 분포
          </h3>
          <p className="text-[10.5px] text-slate-400">
            SARSA 보상 변화율과 BFS 최단경로 감소 방지로 되돌린 수정 빈도
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] tabular-nums">
          {actionKeys.map((key) => (
            <span
              key={key}
              className="whitespace-nowrap rounded border border-[#1b283d] bg-[#0c1422] px-2 py-0.5 text-slate-300"
            >
              <span className="font-bold text-violet-300">{getBuilderActionLabel(key)}</span>:{" "}
              {actionCounts[key]}회
            </span>
          ))}
        </div>
      </div>

      <div className="h-[230px] w-full p-3">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
            시뮬레이션을 시작하면 제작 AI의 보상 궤적이 기록됩니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 14, left: -14, bottom: 2 }}>
              <defs>
                <linearGradient id="builderRewardFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#152136" strokeDasharray="3 3" />
              <XAxis
                dataKey="round"
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                stroke="#1e2d45"
              />
              <YAxis
                domain={[-1.2, 1.4]}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                stroke="#1e2d45"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#070c16",
                  border: "1px solid #223552",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono, Pretendard, sans-serif",
                  boxShadow: "0 0 15px rgba(0,0,0,0.7)",
                }}
                labelFormatter={(label) => `라운드 ${label}`}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "11px",
                  fontFamily: "Pretendard, sans-serif",
                  paddingTop: "6px",
                }}
              />
              <ReferenceLine y={0} stroke="#22334e" strokeWidth={1.5} />
              {eraTransitions.map((roundNum, idx) => (
                <ReferenceLine
                  key={`era-${roundNum}`}
                  x={roundNum}
                  stroke="#a78bfa"
                  strokeDasharray="3 3"
                  label={{
                    value: `시대 ${idx + 2}`,
                    position: "insideTopRight",
                    fill: "#a78bfa",
                    fontSize: 10,
                    fontFamily: "JetBrains Mono",
                  }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="reward"
                name="제작 AI 보상"
                stroke="#a78bfa"
                strokeWidth={2.2}
                fill="url(#builderRewardFill)"
                activeDot={{ r: 4, fill: "#a78bfa", stroke: "#070c16", strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Scatter
                dataKey="revertedPoint"
                name="되돌린 수정 (충돌/경로감소)"
                fill="#f43f5e"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-[#162236] bg-[#070b14] px-3.5 py-2 font-mono text-[10.5px] text-slate-400">
        <span className="font-bold text-violet-300">💡 경쟁 지표 해석:</span> SARSA가 Q-Learning의 탈출 성공률을 30~70%로 통제할 때 최대 보상(+1.00)을 획득합니다. 빨간색 점은 출구 봉쇄나 최단 경로 단축 방지 규칙으로 인해 되돌려진(Reverted) 벽 수정입니다.
      </div>
    </section>
  );
}
