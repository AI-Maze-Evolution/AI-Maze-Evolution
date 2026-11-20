import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { BuilderChart } from "./charts/BuilderChart";
import { RewardChart } from "./charts/RewardChart";
import { StepsChart } from "./charts/StepsChart";
import { SuccessChart } from "./charts/SuccessChart";
import { AgentPanel } from "./components/AgentPanel";
import { ArenaHeader } from "./components/ArenaHeader";
import { BuilderPanel } from "./components/BuilderPanel";
import { CombatLog } from "./components/CombatLog";
import { ControlPanel } from "./components/ControlPanel";
import { Header } from "./components/Header";
import { MazeGrid } from "./components/MazeGrid";
import { StatusBar } from "./components/StatusBar";
import { useSimulationSocket } from "./hooks/useSimulationSocket";
import { parseEdgeWalls } from "./maze/wallUtils";

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

  const currentDisplayWalls = lastResult ? lastResult.walls : state.walls;
  const currentDisplayGrid = lastResult ? lastResult.grid : state.grid;
  const parsedEdges = useMemo(() => parseEdgeWalls(currentDisplayWalls), [currentDisplayWalls]);
  const wallCount = useMemo(() => {
    if (parsedEdges !== null) return parsedEdges.length;
    let count = 0;
    for (const row of currentDisplayGrid) {
      for (const cell of row) {
        if (cell === 1) count += 1;
      }
    }
    return count;
  }, [parsedEdges, currentDisplayGrid]);

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
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

      <main className="mx-auto max-w-[1720px] space-y-3 p-3 sm:p-4">
        {/* 최상단: AI 대결 상태 VS 브로드캐스트 배너 */}
        <ArenaHeader
          lastResult={lastResult}
          status={state.status}
          era={state.era}
          round={state.round}
          size={state.size}
          wallCount={wallCount}
        />

        {/* 시뮬레이션 전투 인터랙션 제어 패널 */}
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

        {/* 적대적 공진화 3-컬럼 대결 아레나 */}
        <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-12">
          {/* [좌측 패널]: SARSA 미로 제작 AI (공격 / 디스럽터) */}
          <div className="min-w-0 xl:col-span-3">
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

          {/* [중앙 메인 아레나]: 미로 전투 뷰포트 + 실시간 이벤트 로그 중계 */}
          <div className="flex min-w-0 flex-col gap-3.5 xl:col-span-6">
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

            {/* 실시간 AI 공진화 전투 이벤트 피드 */}
            <CombatLog
              lastResult={lastResult}
              history={state.history}
              editHistory={state.edit_history}
            />
          </div>

          {/* [우측 패널]: Q-Learning 미로 탈출 AI (방어 / 도전자) */}
          <div className="min-w-0 xl:col-span-3">
            <AgentPanel
              lastResult={lastResult}
              history={state.history}
              stepIndex={stepIndex}
            />
          </div>
        </div>

        {/* 시계열 강화학습 분석 그래프 섹션 (4대 Recharts) */}
        <section aria-label="학습 분석 그래프" className="space-y-2.5 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b273b] pb-2">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-cyan-400" />
              <h2 className="font-mono text-sm font-extrabold text-slate-100">
                강화학습 공진화 수렴 및 정책 진화 시계열 분석
              </h2>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                실시간 자동 동기화
              </span>
              <span>·</span>
              <span>수직 점선 = 시대(Era) 스케일업 전환 지점</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
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
