import type { EngineMode } from "../types/simulation";

interface StatusBarProps {
  mode: EngineMode;
  engineAvailable: boolean;
  era: number;
  eraSizes: number[];
  error: string | null;
}

export function StatusBar({
  mode,
  engineAvailable,
  era,
  eraSizes,
  error,
}: StatusBarProps) {
  return (
    <div className="border-b border-lab-border bg-lab-surface/60">
      <div className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-[11px]">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-[10px] tracking-wide text-slate-500">
            미로 진화 단계
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {eraSizes.map((sz, idx) => {
              const eraNumber = idx + 1;
              const isCurrent = eraNumber === era;
              const isDone = eraNumber < era;
              return (
                <div key={`era-pill-${eraNumber}`} className="flex items-center gap-1">
                  <span
                    className={`border px-2 py-0.5 tabular-nums ${
                      isCurrent
                        ? "border-sky-500/70 bg-sky-950/60 font-semibold text-sky-200"
                        : isDone
                          ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-400"
                          : "border-lab-border bg-lab-bg text-slate-500"
                    }`}
                  >
                    시대 {eraNumber} · {sz}×{sz}
                  </span>
                  {idx < eraSizes.length - 1 && (
                    <span className="text-slate-600">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="border border-rose-700/70 bg-rose-950/70 px-2 py-0.5 font-mono text-rose-200">
              오류: {error}
            </span>
          )}
          {mode === "DEMO" && (
            <span className="text-amber-300/90">
              데모 모드 실행 중 (합성 데이터 ·{" "}
              {engineAvailable
                ? "실제 엔진 전환 가능"
                : "실제 시뮬레이션 엔진 통합 전 독립 검증용"}
              )
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
