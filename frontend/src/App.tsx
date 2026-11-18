import { useCallback, useEffect, useMemo, useState } from "react";
import { BuilderChart } from "./charts/BuilderChart";
import { RewardChart } from "./charts/RewardChart";
import { StepsChart } from "./charts/StepsChart";
import { SuccessChart } from "./charts/SuccessChart";
import { AgentPanel } from "./components/AgentPanel";
import { BuilderPanel } from "./components/BuilderPanel";
import { ControlPanel } from "./components/ControlPanel";
import { Header } from "./components/Header";
import { MazeGrid } from "./components/MazeGrid";
import { MetricCard } from "./components/MetricCard";
import { StatusBar } from "./components/StatusBar";
import { useSimulationSocket } from "./hooks/useSimulationSocket";

export default function App() {
  const { state, connectionStatus, actionError, busy, actions } = useSimulationSocket();
  const [stepIndex, setStepIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);

  const lastResult = state.last_result;

  const maxPathSteps = useMemo(() => {
    if (!lastResult) return 0;
    return Math.max(0, lastResult.best_paths.q.length - 1);
  }, [lastResult]);

  useEffect(() => {
    if (!lastResult) {
      setStepIndex(0);
      setIsReplaying(false);
      return;
    }
    if (state.speed >= 8 && state.status === "running") {
      setStepIndex(maxPathSteps);
      setIsReplaying(false);
      return;
    }
    setStepIndex(0);
    setIsReplaying(true);
  }, [lastResult?.round, maxPathSteps, state.speed, state.status]);

  useEffect(() => {
    if (!isReplaying || maxPathSteps === 0) return;
    const roundBudgetMs =
      state.status === "running" ? (1000 / Math.max(0.5, state.speed)) * 0.78 : 1100;
    const intervalMs = Math.max(
      28,
      Math.min(130, Math.floor(roundBudgetMs / Math.max(1, maxPathSteps))),
    );

    const timer = window.setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= maxPathSteps) {
          setIsReplaying(false);
          return maxPathSteps;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isReplaying, maxPathSteps, state.speed, state.status]);

  const handleManualStepChange = useCallback((nextStep: number) => {
    setIsReplaying(false);
    setStepIndex(nextStep);
  }, []);

  const handleReplayPath = useCallback(() => {
    if (maxPathSteps === 0) return;
    setStepIndex(0);
    setIsReplaying(true);
  }, [maxPathSteps]);

  const combinedError = actionError ?? state.error;
  const qReport = lastResult?.reports.q ?? null;

  return (
    <div className="min-h-screen bg-lab-bg text-lab-text">
      <Header
        mode={state.mode}
        status={state.status}
        era={state.era}
        round={state.round}
        size={state.size}
        seed={state.seed}
        connectionStatus={connectionStatus}
      />

      <StatusBar
        mode={state.mode}
        engineAvailable={state.engine_available}
        era={state.era}
        eraSizes={state.era_sizes}
        error={combinedError}
      />

      <main className="mx-auto max-w-[1640px] space-y-3 p-3 sm:p-4">
        <ControlPanel
          status={state.status}
          speed={state.speed}
          builderMode={state.builder_mode}
          seed={state.seed}
          busy={busy}
          onStart={(seedVal) => actions.start(state.speed, state.builder_mode, seedVal)}
          onPause={() => actions.pause()}
          onResume={() => actions.resume()}
          onStep={() => actions.step()}
          onReset={(mode, seedVal) => actions.reset(mode ?? state.builder_mode, seedVal)}
          onSpeedChange={(spd) => actions.setSpeed(spd)}
        />

        {/* Top KPI Strip (Q-Learning Solver + SARSA/Rule Builder) */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Q-Learning Success"
            value={qReport ? `${(qReport.success_rate * 100).toFixed(1)}%` : "—"}
            sublabel={
              qReport
                ? `Avg ${qReport.avg_steps.toFixed(1)} steps · R ${qReport.avg_reward.toFixed(1)}`
                : "Waiting for round 1"
            }
            accent="q"
          />
          <MetricCard
            label="Early Adaptation"
            value={qReport ? `${(qReport.early_success_rate * 100).toFixed(1)}%` : "—"}
            sublabel="First 10 episodes post-edit"
            accent="merged"
          />
          <MetricCard
            label="Builder Action"
            value={lastResult?.builder_action_name ?? "—"}
            sublabel={
              lastResult?.edit
                ? `${lastResult.edit.type} (${lastResult.edit.pos[0]},${lastResult.edit.pos[1]})${
                    lastResult.edit_reverted ? " · reverted" : ""
                  }`
                : `${state.builder_mode.toUpperCase()} Builder`
            }
            accent="builder"
          />
          <MetricCard
            label="Builder Reward"
            value={lastResult ? lastResult.builder_reward.toFixed(2) : "—"}
            sublabel="Target solver band 30%–70%"
            accent="sarsa"
          />
          <MetricCard
            label="BFS Shortest Path"
            value={
              qReport && qReport.shortest_path_len !== null ? `${qReport.shortest_path_len}` : "—"
            }
            sublabel={`Era ${state.era} · Next Grid ${state.size}×${state.size}`}
            accent="neutral"
          />
        </div>

        {/* Main Maze Stage + Solver & Builder Inspectors */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <MazeGrid
              currentGrid={state.grid}
              currentStart={state.start}
              currentGoal={state.goal}
              prevGrid={state.prev_grid}
              lastResult={lastResult}
              stepIndex={stepIndex}
              maxPathSteps={maxPathSteps}
              onStepIndexChange={handleManualStepChange}
              onReplayPath={handleReplayPath}
            />
          </div>

          <div className="flex flex-col gap-3 xl:col-span-5">
            <AgentPanel
              lastResult={lastResult}
              history={state.history}
              stepIndex={stepIndex}
            />
            <BuilderPanel
              builderMode={state.builder_mode}
              lastResult={lastResult}
              currentGrid={state.grid}
              prevGrid={state.prev_grid}
              editHistory={state.edit_history}
              era={state.era}
              eraSizes={state.era_sizes}
            />
          </div>
        </div>

        {/* Training Analytics */}
        <section aria-label="Learning Analytics Charts" className="space-y-2">
          <div className="flex items-center justify-between border-b border-lab-border pb-1.5">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
              Training Analytics &amp; Convergence Curves
            </h2>
            <span className="font-mono text-[10px] text-slate-500">
              Real-time updates via WS /ws/simulation · dashed verticals = Era transitions
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <SuccessChart history={state.history} eraTransitions={state.era_transitions} />
            <RewardChart history={state.history} eraTransitions={state.era_transitions} />
            <StepsChart history={state.history} eraTransitions={state.era_transitions} />
            <BuilderChart history={state.history} eraTransitions={state.era_transitions} />
          </div>
        </section>
      </main>
    </div>
  );
}
