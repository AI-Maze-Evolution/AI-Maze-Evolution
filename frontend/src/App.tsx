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
import { formatEditTarget } from "./maze/wallUtils";
import { getBuilderActionLabel } from "./types/simulation";

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

  const latestEditSummary = (() => {
    if (!lastResult?.edit) {
      return state.builder_mode === "sarsa" ? "SARSA 제작 AI" : "규칙 기반 제작 AI";
    }
    return `${formatEditTarget(lastResult.edit)}${lastResult.edit_reverted ? " · 되돌림" : ""}`;
  })();

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
          engineMode={state.mode}
          engineAvailable={state.engine_available}
          seed={state.seed}
          busy={busy}
          onStart={(seedVal) => actions.start(state.speed, state.builder_mode, seedVal)}
          onPause={() => actions.pause()}
          onResume={() => actions.resume()}
          onStep={() => actions.step()}
          onReset={(mode, seedVal, reqEngine) =>
            actions.reset(mode ?? state.builder_mode, seedVal, reqEngine)
          }
          onSpeedChange={(spd) => actions.setSpeed(spd)}
        />

        {/* 핵심 지표 요약 */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Q-Learning 탈출 성공률"
            value={qReport ? `${(qReport.success_rate * 100).toFixed(1)}%` : "—"}
            sublabel={
              qReport
                ? `평균 ${qReport.avg_steps.toFixed(1)}회 이동 · 보상 ${qReport.avg_reward.toFixed(1)}`
                : "1라운드 실행 대기 중"
            }
            accent="q"
          />
          <MetricCard
            label="초기 적응률"
            value={qReport ? `${(qReport.early_success_rate * 100).toFixed(1)}%` : "—"}
            sublabel="미로 수정 직후 초기 10회 에피소드"
            accent="merged"
          />
          <MetricCard
            label="제작 AI 행동"
            value={getBuilderActionLabel(lastResult?.builder_action_name)}
            sublabel={latestEditSummary}
            accent="builder"
          />
          <MetricCard
            label="미로 제작 AI 보상"
            value={lastResult ? lastResult.builder_reward.toFixed(2) : "—"}
            sublabel="목표 탈출 성공률 구간 30%–70%"
            accent="sarsa"
          />
          <MetricCard
            label="BFS 최단 경로"
            value={
              qReport && qReport.shortest_path_len !== null ? `${qReport.shortest_path_len}칸` : "—"
            }
            sublabel={`시대 ${state.era} · 다음 미로 ${state.size}×${state.size}`}
            accent="neutral"
          />
        </div>

        {/* 중앙 미로 시뮬레이션 + 탈출 AI / 제작 AI 패널 */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-7">
            <MazeGrid
              currentGrid={state.grid}
              currentWalls={state.walls}
              currentStart={state.start}
              currentGoal={state.goal}
              prevGrid={state.prev_grid}
              prevWalls={state.prev_walls}
              lastResult={lastResult}
              stepIndex={stepIndex}
              maxPathSteps={maxPathSteps}
              onStepIndexChange={handleManualStepChange}
              onReplayPath={handleReplayPath}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3 xl:col-span-5">
            <AgentPanel
              lastResult={lastResult}
              history={state.history}
              stepIndex={stepIndex}
            />
            <BuilderPanel
              builderMode={state.builder_mode}
              lastResult={lastResult}
              currentGrid={state.grid}
              currentWalls={state.walls}
              currentStart={state.start}
              currentGoal={state.goal}
              prevGrid={state.prev_grid}
              prevWalls={state.prev_walls}
              editHistory={state.edit_history}
              era={state.era}
              eraSizes={state.era_sizes}
            />
          </div>
        </div>

        {/* 학습 분석 그래프 */}
        <section aria-label="학습 분석 그래프" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lab-border pb-1.5">
            <h2 className="font-mono text-xs font-semibold text-slate-300">
              학습 분석 및 수렴 추이
            </h2>
            <span className="font-mono text-[10px] text-slate-500">
              실시간 연결로 자동 갱신 · 점선 세로선 = 시대 전환 지점
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
