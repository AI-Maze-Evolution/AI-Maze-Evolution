import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryItem } from "../types/simulation";

interface SuccessChartProps {
  history: HistoryItem[];
  eraTransitions: number[];
}

export function SuccessChart({ history, eraTransitions }: SuccessChartProps) {
  const data = history.map((pt) => ({
    round: pt.round,
    success: Number((pt.success_rate * 100).toFixed(1)),
    early: Number((pt.early_success_rate * 100).toFixed(1)),
  }));

  return (
    <section className="instrument-card flex flex-col overflow-hidden rounded-md shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-[#1b273b] bg-[#090e18] px-3.5 py-2.5">
        <div>
          <h3 className="font-mono text-xs font-bold text-slate-100">
            탈출 성공률 및 초기 적응률 추이
          </h3>
          <p className="text-[10.5px] text-slate-400">
            Q-Learning 라운드 전체 성공률 vs 미로 수정 직후 10회 에피소드 성공률
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-emerald-600/50 bg-emerald-950/40 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-emerald-300">
            목표 구간 30%–70%
          </span>
        </div>
      </div>

      <div className="h-[230px] w-full p-3">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
            시뮬레이션을 시작하면 학습 수렴 곡선이 기록됩니다.
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
                domain={[0, 100]}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                stroke="#1e2d45"
                unit="%"
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
                formatter={(value: number) => [`${value}%`, undefined]}
                labelFormatter={(label) => `라운드 ${label}`}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "11px",
                  fontFamily: "Pretendard, sans-serif",
                  paddingTop: "6px",
                }}
              />
              {/* 목표 수렴 밴드 30%~70% */}
              <ReferenceArea
                y1={30}
                y2={70}
                fill="#10b981"
                fillOpacity={0.04}
                stroke="#10b981"
                strokeOpacity={0.15}
                strokeDasharray="2 2"
              />
              <ReferenceLine y={70} stroke="#10b981" strokeOpacity={0.3} strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke="#10b981" strokeOpacity={0.3} strokeDasharray="3 3" />

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

              <Line
                type="monotone"
                dataKey="success"
                name="전체 탈출 성공률"
                stroke="#38bdf8"
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, fill: "#38bdf8", stroke: "#070c16", strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="early"
                name="초기 10회 적응률"
                stroke="#10b981"
                strokeWidth={1.8}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4, fill: "#10b981", stroke: "#070c16", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-[#162236] bg-[#070b14] px-3.5 py-2 font-mono text-[10.5px] text-slate-400">
        <span className="font-bold text-cyan-300">💡 경쟁 지표 해석:</span> Q-Learning 탈출 성공률이 녹색 목표 밴드(30%~70%)에 머물수록 SARSA가 탈출을 효과적으로 방해하여 높은 보상을 획득합니다. 70% 초과 시 Q-Learning 우세, 30% 미만 시 미로 과도 난이도를 뜻합니다.
      </div>
    </section>
  );
}
