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
    <section className="flex flex-col border border-lab-border bg-lab-surface">
      <div className="flex items-center justify-between border-b border-lab-border px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Q-Learning Escape Success &amp; Early Adaptation
          </h3>
          <p className="text-[11px] text-slate-500">
            Full round success rate vs first-10-episode adaptation (%)
          </p>
        </div>
        <span className="font-mono text-[10px] text-emerald-400">BAND 30%–70%</span>
      </div>

      <div className="h-[220px] w-full p-2.5">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
            Awaiting round telemetry…
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
                domain={[0, 100]}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                stroke="#223047"
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1220",
                  border: "1px solid #2c3e5a",
                  borderRadius: "3px",
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono",
                }}
                formatter={(value: number) => [`${value}%`, undefined]}
                labelFormatter={(label) => `Round ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />
              <ReferenceLine y={70} stroke="#334155" strokeDasharray="4 4" />
              <ReferenceLine y={30} stroke="#334155" strokeDasharray="4 4" />
              {eraTransitions.map((roundNum, idx) => (
                <ReferenceLine
                  key={`era-${roundNum}`}
                  x={roundNum}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  label={{
                    value: `Era ${idx + 2}`,
                    position: "insideTopRight",
                    fill: "#94a3b8",
                    fontSize: 9,
                  }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="success"
                name="Success Rate"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="early"
                name="Early Adaptation"
                stroke="#10b981"
                strokeWidth={1.6}
                strokeDasharray="4 3"
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
