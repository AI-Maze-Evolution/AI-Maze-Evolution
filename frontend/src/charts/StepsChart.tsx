import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryItem } from "../types/simulation";

interface StepsChartProps {
  history: HistoryItem[];
  eraTransitions: number[];
}

export function StepsChart({ history, eraTransitions }: StepsChartProps) {
  const data = history.map((pt) => ({
    round: pt.round,
    steps: Number(pt.avg_steps.toFixed(1)),
  }));

  return (
    <section className="instrument-card flex flex-col overflow-hidden rounded-md shadow-md">
      <div className="border-b border-[#1b273b] bg-[#090e18] px-3.5 py-2.5">
        <h3 className="font-mono text-xs font-bold text-slate-100">
          탈출 AI 평균 탐색 스텝 수
        </h3>
        <p className="text-[10.5px] text-slate-400">
          미로 크기 확장 및 난이도 진화에 따른 평균 이동 스텝
        </p>
      </div>

      <div className="h-[230px] w-full p-3">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
            시뮬레이션을 시작하면 스텝 소요 추세가 기록됩니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 14, left: -14, bottom: 2 }}>
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
                formatter={(value: number) => [`${value}스텝`, undefined]}
                labelFormatter={(label) => `라운드 ${label}`}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "11px",
                  fontFamily: "Pretendard, sans-serif",
                  paddingTop: "6px",
                }}
              />
              {eraTransitions.map((roundNum, idx) => (
                <ReferenceLine
                  key={`era-${roundNum}`}
                  x={roundNum}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{
                    value: `시대 ${idx + 2}`,
                    position: "insideTopRight",
                    fill: "#f59e0b",
                    fontSize: 10,
                    fontFamily: "JetBrains Mono",
                  }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="steps"
                name="평균 이동 횟수"
                stroke="#f59e0b"
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, fill: "#f59e0b", stroke: "#070c16", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-[#162236] bg-[#070b14] px-3.5 py-2 font-mono text-[10.5px] text-slate-400">
        <span className="font-bold text-amber-300">💡 경쟁 지표 해석:</span> Q-Learning의 평균 스텝 수가 감소할수록 불필요한 방황 없이 최적의 탈출 루트에 수렴한 것이며, 스텝 수가 다시 튀어오를 때는 SARSA가 새로운 벽으로 우회로를 강제했음을 보여줍니다.
      </div>
    </section>
  );
}
