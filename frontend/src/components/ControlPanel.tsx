import { useEffect, useState } from "react";
import {
  Brain,
  Cpu,
  Gauge,
  Hash,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  StepForward,
} from "lucide-react";
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
      aria-label="시뮬레이션 제어 계측기"
      className="instrument-card rounded-md p-3 shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 주 실행 제어 버튼 그룹 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            title="시뮬레이션 자동 실행을 시작합니다"
            disabled={busy || !canStart}
            onClick={() => onStart(parsedSeed)}
            className="inline-flex items-center gap-1.5 rounded border border-emerald-500/60 bg-emerald-950/60 px-3.5 py-1.5 font-mono text-xs font-bold text-emerald-200 transition-all hover:bg-emerald-900/80 hover:shadow-[0_0_12px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            시작
          </button>

          <button
            type="button"
            title="진행 중인 시뮬레이션을 일시정지합니다"
            disabled={busy || !canPause}
            onClick={onPause}
            className="inline-flex items-center gap-1.5 rounded border border-amber-500/60 bg-amber-950/60 px-3.5 py-1.5 font-mono text-xs font-bold text-amber-200 transition-all hover:bg-amber-900/80 hover:shadow-[0_0_12px_rgba(245,158,11,0.35)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Pause className="h-3.5 w-3.5 fill-current" />
            일시정지
          </button>

          <button
            type="button"
            title="일시정지된 시뮬레이션을 재개합니다"
            disabled={busy || !canResume}
            onClick={onResume}
            className="inline-flex items-center gap-1.5 rounded border border-sky-500/60 bg-sky-950/60 px-3.5 py-1.5 font-mono text-xs font-bold text-sky-200 transition-all hover:bg-sky-900/80 hover:shadow-[0_0_12px_rgba(56,189,248,0.35)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            재개
          </button>

          <button
            type="button"
            title="시뮬레이션을 1라운드만 수동 실행합니다"
            disabled={busy || !canStep}
            onClick={onStep}
            className="inline-flex items-center gap-1.5 rounded border border-[#233550] bg-[#121c2d] px-3.5 py-1.5 font-mono text-xs font-bold text-slate-100 transition-all hover:border-slate-400 hover:bg-[#1a273e] hover:shadow-[0_0_10px_rgba(148,163,184,0.2)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <StepForward className="h-3.5 w-3.5" />
            한 라운드 실행
          </button>

          <button
            type="button"
            title="시뮬레이션과 학습 기록을 시대 1로 초기화합니다"
            disabled={busy}
            onClick={() => onReset(builderMode, parsedSeed)}
            className="inline-flex items-center gap-1.5 rounded border border-[#233550] bg-[#090e18] px-3.5 py-1.5 font-mono text-xs font-bold text-slate-300 transition-all hover:border-rose-500/70 hover:bg-rose-950/40 hover:text-rose-200 hover:shadow-[0_0_10px_rgba(244,63,94,0.25)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
        </div>

        {/* 정밀 튜닝 컨트롤 그룹: 속도 슬라이더, 시드, 알고리즘 선택, 엔진 모드 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 실행 속도 */}
          <div className="flex items-center gap-2 rounded border border-[#1b273b] bg-[#090e17] px-2.5 py-1">
            <Gauge className="h-3.5 w-3.5 text-sky-400" />
            <label
              htmlFor="sim-speed-slider"
              className="whitespace-nowrap font-mono text-[11px] text-slate-400"
            >
              속도
            </label>
            <input
              id="sim-speed-slider"
              type="range"
              min={0.5}
              max={15}
              step={0.5}
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="lab-slider w-20 sm:w-28"
              aria-label="시뮬레이션 실행 속도 조절"
            />
            <span className="w-16 whitespace-nowrap text-right font-mono text-xs font-bold text-sky-300 tabular-nums">
              {speed.toFixed(1)} <span className="text-[10px] text-slate-400">R/s</span>
            </span>
          </div>

          {/* 시드(Seed) */}
          <div className="flex items-center gap-1.5 rounded border border-[#1b273b] bg-[#090e17] px-2.5 py-1">
            <Hash className="h-3.5 w-3.5 text-slate-400" />
            <label
              htmlFor="sim-seed-input"
              className="font-mono text-[11px] text-slate-400"
            >
              시드
            </label>
            <input
              id="sim-seed-input"
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              aria-label="난수 시드 입력"
              className="w-16 rounded border border-[#22334f] bg-[#0d1421] px-1.5 py-0.5 text-center font-mono text-xs font-semibold text-slate-100 tabular-nums transition-colors focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* 미로 제작 AI 모드 세그먼트 */}
          <div className="flex items-center gap-1.5 rounded border border-[#1b273b] bg-[#090e17] p-1">
            <Brain className="ml-1.5 h-3.5 w-3.5 text-violet-400" />
            <span className="whitespace-nowrap font-mono text-[11px] text-slate-400 mr-1">
              제작 AI
            </span>
            <div className="inline-flex rounded bg-[#0d1421] p-0.5 font-mono text-[11px]">
              <button
                type="button"
                title="SARSA 기반 강화학습 미로 제작 AI로 전환합니다"
                disabled={busy}
                onClick={() => onReset("sarsa", parsedSeed)}
                className={`rounded px-2.5 py-1 font-semibold transition-all ${
                  builderMode === "sarsa"
                    ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(167,139,250,0.4)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                SARSA
              </button>
              <button
                type="button"
                title="규칙 기반(휴리스틱) 미로 제작 AI로 전환합니다"
                disabled={busy}
                onClick={() => onReset("rule", parsedSeed)}
                className={`rounded px-2.5 py-1 font-semibold transition-all ${
                  builderMode === "rule"
                    ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(167,139,250,0.4)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                규칙 기반
              </button>
            </div>
          </div>

          {/* 엔진 모드 세그먼트 */}
          <div className="flex items-center gap-1.5 rounded border border-[#1b273b] bg-[#090e17] p-1">
            <span className="whitespace-nowrap font-mono text-[11px] text-slate-400 ml-1.5 mr-1">
              엔진
            </span>
            <div className="inline-flex rounded bg-[#0d1421] p-0.5 font-mono text-[11px]">
              <button
                type="button"
                title="실제 Python 강화학습 엔진(core/simulation.py)으로 실행합니다"
                disabled={busy || !engineAvailable}
                onClick={() => onReset(builderMode, parsedSeed, "real")}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition-all disabled:opacity-35 ${
                  engineMode === "REAL"
                    ? "bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Cpu className="h-3 w-3" />
                실제 엔진
              </button>
              <button
                type="button"
                title="core/passage_maze.py 고정 배치 경계선 벽(10/25/50개) 데모 모드로 전환합니다"
                disabled={busy}
                onClick={() => onReset(builderMode, parsedSeed, "demo")}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition-all ${
                  engineMode === "DEMO"
                    ? "bg-amber-600 text-slate-950 font-bold shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                벽 데모
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
