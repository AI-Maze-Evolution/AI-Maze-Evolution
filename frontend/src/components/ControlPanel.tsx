import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type { BuilderMode, SimulationStatus } from "../types/simulation";

interface ControlPanelProps {
  status: SimulationStatus;
  speed: number;
  builderMode: BuilderMode;
  seed: number;
  busy: boolean;
  onStart: (seed?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: (builderMode?: BuilderMode, seed?: number) => void;
  onSpeedChange: (speed: number) => void;
}

export function ControlPanel({
  status,
  speed,
  builderMode,
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

  const parsedSeed = Number.isFinite(Number(seedInput)) && seedInput.trim() !== ""
    ? Math.trunc(Number(seedInput))
    : seed;

  const canStart = status === "idle";
  const canPause = status === "running";
  const canResume = status === "paused";
  const canStep = status === "idle" || status === "paused" || status === "running";

  return (
    <section
      aria-label="Simulation Controls"
      className="border border-lab-border bg-lab-surface px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Transport Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={busy || !canStart}
            onClick={() => onStart(parsedSeed)}
            className="inline-flex items-center gap-1.5 border border-emerald-600/70 bg-emerald-950/70 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-900/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Play className="h-3.5 w-3.5" />
            START
          </button>

          <button
            type="button"
            disabled={busy || !canPause}
            onClick={onPause}
            className="inline-flex items-center gap-1.5 border border-amber-600/70 bg-amber-950/70 px-3 py-1.5 font-mono text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-900/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Pause className="h-3.5 w-3.5" />
            PAUSE
          </button>

          <button
            type="button"
            disabled={busy || !canResume}
            onClick={onResume}
            className="inline-flex items-center gap-1.5 border border-sky-600/70 bg-sky-950/70 px-3 py-1.5 font-mono text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-900/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Play className="h-3.5 w-3.5" />
            RESUME
          </button>

          <button
            type="button"
            disabled={busy || !canStep}
            onClick={onStep}
            className="inline-flex items-center gap-1.5 border border-lab-border bg-lab-panel px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <SkipForward className="h-3.5 w-3.5" />
            STEP
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onReset(builderMode, parsedSeed)}
            className="inline-flex items-center gap-1.5 border border-lab-border bg-lab-bg px-3 py-1.5 font-mono text-xs font-semibold text-slate-300 transition-colors hover:border-rose-600/70 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            RESET
          </button>
        </div>

        {/* Speed, Seed, Builder Mode */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <label
              htmlFor="sim-speed-slider"
              className="font-mono text-[11px] uppercase tracking-wider text-slate-400"
            >
              Speed
            </label>
            <input
              id="sim-speed-slider"
              type="range"
              min={0.5}
              max={15}
              step={0.5}
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="lab-slider w-28 sm:w-36"
            />
            <span className="w-14 text-right font-mono text-xs font-semibold text-sky-300 tabular-nums">
              {speed.toFixed(1)} r/s
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-lab-border pl-3">
            <label
              htmlFor="sim-seed-input"
              className="font-mono text-[10px] uppercase tracking-wider text-slate-500"
            >
              Seed
            </label>
            <input
              id="sim-seed-input"
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="w-20 border border-lab-border bg-lab-bg px-2 py-1 font-mono text-[11px] text-slate-100 tabular-nums focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 border-l border-lab-border pl-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Builder
            </span>
            <div className="inline-flex border border-lab-border bg-lab-bg font-mono text-[11px]">
              <button
                type="button"
                disabled={busy}
                onClick={() => onReset("sarsa", parsedSeed)}
                className={`px-2 py-1 transition-colors ${
                  builderMode === "sarsa"
                    ? "bg-violet-950/80 font-semibold text-violet-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                SARSA Builder
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onReset("rule", parsedSeed)}
                className={`border-l border-lab-border px-2 py-1 transition-colors ${
                  builderMode === "rule"
                    ? "bg-violet-950/80 font-semibold text-violet-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Rule-Based
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
