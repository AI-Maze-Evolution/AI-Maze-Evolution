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
    <section className="flex flex-col border border-lab-border bg-lab-surface">
      <div className="border-b border-lab-border px-3 py-2">
        <h3 className="text-xs font-semibold text-slate-200">
          탈출 AI 평균 이동 횟수
        </h3>
        <p className="text-[11px] text-slate-500">
          미로 난이도 변화에 따른 탈출 시도당 평균 이동 횟수
        </p>
      </div>

      <div className="h-[220px] w-full p-2.5">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
            표시할 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
                formatter={(value: number) => [`${value}회`, undefined]}
                labelFormatter={(label) => `라운드 ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />
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
              <Line
                type="monotone"
                dataKey="steps"
                name="평균 이동 횟수"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
