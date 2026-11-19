import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type {
  BuilderMode,
  EngineMode,
  RequestedEngineMode,
  SimulationStatus,
} from "../types/simulation";

interface ControlPanelProps {
  status: SimulationStatus;
  speed: number;
  builderMode: BuilderMode;
  engineMode: EngineMode;
  engineAvailable: boolean;
  seed: number;
  busy: boolean;
  onStart: (seed?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: (
    builderMode?: BuilderMode,
    seed?: number,
    requestedEngineMode?: RequestedEngineMode,
  ) => void;
  onSpeedChange: (speed: number) => void;
}

export function ControlPanel({
  status,
  speed,
  builderMode,
  engineMode,
  engineAvailable,
  seed,
  busy,
  onStart,
  onPause,
  onResume,
  onStep,
  onReset,
  onSpeedChange,
}: ControlPanelProps) {
  const [seedInput, setSeedInput] = useState(String(seed));

  useEffect(() => {
    setSeedInput(String(seed));
  }, [seed]);

  const parsedSeed =
    Number.isFinite(Number(seedInput)) && seedInput.trim() !== ""
      ? Math.trunc(Number(seedInput))
      : seed;

  const canStart = status === "idle";
  const canPause = status === "running";
  const canResume = status === "paused";
  const canStep = status === "idle" || status === "paused" || status === "running";

  return (
    <section
      aria-label="시뮬레이션 제어"
      className="border border-lab-border bg-lab-surface px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 제어 버튼 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            title="시뮬레이션 자동 실행을 시작합니다"
            disabled={busy || !canStart}
            onClick={() => onStart(parsedSeed)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap border border-emerald-600/70 bg-emerald-950/70 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-900/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Play className="h-3.5 w-3.5" />
            시작
          </button>

          <button
            type="button"
            title="진행 중인 시뮬레이션을 일시정지합니다"
            disabled={busy || !canPause}
            onClick={onPause}
            className="inline-flex items-center gap-1.5 whitespace-nowrap border border-amber-600/70 bg-amber-950/70 px-3 py-1.5 font-mono text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-900/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Pause className="h-3.5 w-3.5" />
            일시정지
          </button>

          <button
            type="button"
            title="일시정지된 시뮬레이션을 재개합니다"
            disabled={busy || !canResume}
            onClick={onResume}
            className="inline-flex items-center gap-1.5 whitespace-nowrap border border-sky-600/70 bg-sky-950/70 px-3 py-1.5 font-mono text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-900/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Play className="h-3.5 w-3.5" />
            재개
          </button>

          <button
            type="button"
            title="시뮬레이션을 1라운드만 수동 실행합니다"
            disabled={busy || !canStep}
            onClick={onStep}
            className="inline-flex items-center gap-1.5 whitespace-nowrap border border-lab-border bg-lab-panel px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <SkipForward className="h-3.5 w-3.5" />
            한 라운드 실행
          </button>

          <button
            type="button"
            title="시뮬레이션과 학습 기록을 시대 1로 초기화합니다"
            disabled={busy}
            onClick={() => onReset(builderMode, parsedSeed)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap border border-lab-border bg-lab-bg px-3 py-1.5 font-mono text-xs font-semibold text-slate-300 transition-colors hover:border-rose-600/70 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
        </div>

        {/* 실행 속도, 시드, 제작 AI, 엔진 모드 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="sim-speed-slider"
              className="whitespace-nowrap font-mono text-[11px] text-slate-400"
            >
              실행 속도
            </label>
            <input
              id="sim-speed-slider"
              type="range"
              min={0.5}
              max={15}
              step={0.5}
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="lab-slider w-24 sm:w-32"
              aria-label="시뮬레이션 실행 속도"
            />
            <span className="w-20 whitespace-nowrap text-right font-mono text-xs font-semibold text-sky-300 tabular-nums">
              {speed.toFixed(1)} 라운드/초
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-lab-border pl-3">
            <label
              htmlFor="sim-seed-input"
              className="font-mono text-[11px] text-slate-500"
            >
              시드
            </label>
            <input
              id="sim-seed-input"
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              aria-label="난수 시드"
              className="w-16 border border-lab-border bg-lab-bg px-2 py-1 font-mono text-[11px] text-slate-100 tabular-nums focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 border-l border-lab-border pl-3">
            <span className="whitespace-nowrap font-mono text-[11px] text-slate-500">
              제작 AI
            </span>
            <div className="inline-flex border border-lab-border bg-lab-bg font-mono text-[11px]">
              <button
                type="button"
                title="SARSA 기반 미로 제작 AI로 초기화합니다"
                disabled={busy}
                onClick={() => onReset("sarsa", parsedSeed)}
                className={`whitespace-nowrap px-2 py-1 transition-colors ${
                  builderMode === "sarsa"
                    ? "bg-violet-950/80 font-semibold text-violet-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                SARSA 제작 AI
              </button>
              <button
                type="button"
                title="규칙 기반 미로 제작 AI로 초기화합니다"
                disabled={busy}
                onClick={() => onReset("rule", parsedSeed)}
                className={`whitespace-nowrap border-l border-lab-border px-2 py-1 transition-colors ${
                  builderMode === "rule"
                    ? "bg-violet-950/80 font-semibold text-violet-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                규칙 기반
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-l border-lab-border pl-3">
            <span className="whitespace-nowrap font-mono text-[11px] text-slate-500">
              엔진
            </span>
            <div className="inline-flex border border-lab-border bg-lab-bg font-mono text-[11px]">
              <button
                type="button"
                title="실제 Python 강화학습 엔진(core/simulation.py)으로 실행합니다"
                disabled={busy || !engineAvailable}
                onClick={() => onReset(builderMode, parsedSeed, "real")}
                className={`whitespace-nowrap px-2 py-1 transition-colors disabled:opacity-35 ${
                  engineMode === "REAL"
                    ? "bg-emerald-950/80 font-semibold text-emerald-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                실제 엔진
              </button>
              <button
                type="button"
                title="core/passage_maze.py 고정 배치 경계선 벽(10/25/50개) 데모 미리보기"
                disabled={busy}
                onClick={() => onReset(builderMode, parsedSeed, "demo")}
                className={`whitespace-nowrap border-l border-lab-border px-2 py-1 transition-colors ${
                  engineMode === "DEMO"
                    ? "bg-amber-950/80 font-semibold text-amber-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                경계선 벽 데모
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
