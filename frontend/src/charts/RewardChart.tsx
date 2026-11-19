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
    <section className="instrument-card flex flex-col overflow-hidden rounded-md shadow-md">
      <div className="border-b border-[#1b273b] bg-[#090e18] px-3.5 py-2.5">
        <h3 className="font-mono text-xs font-bold text-slate-100">
          탈출 AI 평균 에피소드 보상 곡선
        </h3>
        <p className="text-[10.5px] text-slate-400">
          Q-Learning 에이전트가 에피소드당 획득한 평균 누적 보상 추세
        </p>
      </div>

      <div className="h-[230px] w-full p-3">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
            시뮬레이션을 시작하면 보상 수렴 곡선이 기록됩니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 14, left: -14, bottom: 2 }}>
              <defs>
                <linearGradient id="solverRewardFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#152136" strokeDasharray="3 3" />
              <XAxis
                dataKey="round"
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                stroke="#1e2d45"
              />
              <YAxis
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
                  stroke="#38bdf8"
                  strokeDasharray="3 3"
                  label={{
                    value: `시대 ${idx + 2}`,
                    position: "insideTopRight",
                    fill: "#38bdf8",
                    fontSize: 10,
                    fontFamily: "JetBrains Mono",
                  }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="reward"
                name="평균 에피소드 보상"
                stroke="#38bdf8"
                strokeWidth={2.2}
                fill="url(#solverRewardFill)"
                activeDot={{ r: 4, fill: "#38bdf8", stroke: "#070c16", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-[#162236] bg-[#070b14] px-3.5 py-2 font-mono text-[10.5px] text-slate-400">
        <span className="font-bold text-sky-300">💡 경쟁 지표 해석:</span> Q-Learning의 에피소드 평균 보상이 상승하면 효율적인 탈출 경로를 개척했음을 의미하며, 급격한 하락은 SARSA의 벽 추가/이동으로 기존 탈출 경로가 차단되었음을 의미합니다.
      </div>
    </section>
  );
}
