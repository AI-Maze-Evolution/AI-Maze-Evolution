import { AlertTriangle, CheckCircle2, ChevronRight, Layers } from "lucide-react";
import type { EngineMode } from "../types/simulation";

interface StatusBarProps {
  mode: EngineMode;
  engineAvailable: boolean;
  era: number;
  eraSizes: number[];
  error: string | null;
}

const DEMO_ERA_WALL_COUNTS: Record<number, number> = {
  5: 10,
  7: 25,
  10: 50,
};

const REAL_ERA_WALL_COUNTS: Record<number, number> = {
  5: 2,
  7: 7,
  10: 20,
};

export function StatusBar({
  mode,
  engineAvailable,
  era,
  eraSizes,
  error,
}: StatusBarProps) {
  return (
    <div className="border-b border-[#1b263b] bg-[#090e18]/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-1.5 text-xs">
        {/* 미로 진화 파이프라인 (Era Progression Pipeline) */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Layers className="h-3.5 w-3.5 text-sky-400" />
            <span>미로 복잡도 진화</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {eraSizes.map((sz, idx) => {
              const eraNumber = idx + 1;
              const isCurrent = eraNumber === era;
              const isDone = eraNumber < era;
              const wallCount =
                mode === "DEMO"
                  ? DEMO_ERA_WALL_COUNTS[sz] ?? 10
                  : REAL_ERA_WALL_COUNTS[sz] ?? Math.round(sz * sz * 0.1);
              const wallLabel = mode === "DEMO" ? "경계선 벽" : "초기 벽";

              return (
                <div key={`era-stage-${eraNumber}`} className="flex items-center gap-1.5">
                  <div
                    className={`flex items-center gap-2 rounded px-2.5 py-1 text-[11px] transition-all ${
                      isCurrent
                        ? "border border-sky-500/70 bg-sky-950/50 font-bold text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.22)]"
                        : isDone
                          ? "border border-emerald-800/60 bg-emerald-950/30 text-emerald-300 font-medium"
                          : "border border-[#1e2a3f] bg-[#0c121e] text-slate-500"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : isCurrent ? (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                      </span>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                    )}
                    <span>
                      시대 {eraNumber} <span className="text-slate-400">({sz}×{sz} · {wallLabel} {wallCount}개)</span>
                    </span>
                  </div>

                  {idx < eraSizes.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-slate-600" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 상태 메시지 및 오류 알림 */}
        <div className="flex flex-wrap items-center gap-3">
          {error && (
            <div className="flex items-center gap-1.5 rounded border border-rose-600/60 bg-rose-950/60 px-2.5 py-0.5 font-mono text-[11px] text-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.3)]">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              <span>오류 발생: {error}</span>
            </div>
          )}

          {mode === "DEMO" && (
            <div className="flex items-center gap-1 text-[11px] text-amber-300/90 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>
                데모 모드 실행 중 (
                {engineAvailable
                  ? "실제 엔진으로 즉시 전환 가능"
                  : "경계선 벽 고정 배치 독립 검증"}
                )
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
