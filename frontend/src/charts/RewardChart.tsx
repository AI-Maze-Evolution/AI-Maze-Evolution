import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryItem } from "../types/simulation";

interface RewardChartProps {
  history: HistoryItem[];
  eraTransitions: number[];
}

export function RewardChart({ history, eraTransitions }: RewardChartProps) {
  const data = history.map((pt) => ({
    round: pt.round,
    reward: Number(pt.avg_reward.toFixed(1)),
  }));

  return (
    <section className="flex flex-col border border-lab-border bg-lab-surface">
      <div className="border-b border-lab-border px-3 py-2">
        <h3 className="text-xs font-semibold text-slate-200">
          탈출 AI 평균 에피소드 보상
        </h3>
        <p className="text-[11px] text-slate-500">
          Q-Learning의 에피소드당 평균 누적 보상
        </p>
      </div>

      <div className="h-[220px] w-full p-2.5">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
            표시할 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="solverRewardFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1a263b" strokeDasharray="3 3" />
              <XAxis
                dataKey="round"
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                stroke="#223047"
              />
              <YAxis
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
              <ReferenceLine y={0} stroke="#334155" />
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
                name="평균 보상"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#solverRewardFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
