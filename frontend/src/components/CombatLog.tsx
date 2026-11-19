import { useMemo, useState } from "react";
import {
  Brain,
  ChevronDown,
  Navigation,
  Sparkles,
  Swords,
} from "lucide-react";
import { formatEditTarget } from "../maze/wallUtils";
import { getBuilderActionLabel } from "../types/simulation";
import type { EditHistoryEntry, HistoryItem, RoundResult } from "../types/simulation";

interface CombatEvent {
  id: string;
  round: number;
  era: number;
  agent: "sarsa" | "q" | "system" | "outcome";
  title: string;
  detail: string;
  badge: string;
  statusColor: string;
  rewardText?: string;
}

interface CombatLogProps {
  lastResult: RoundResult | null;
  history: HistoryItem[];
  editHistory: EditHistoryEntry[];
}

export function CombatLog({ lastResult: _lastResult, history, editHistory }: CombatLogProps) {
  const [filter, setFilter] = useState<"all" | "sarsa" | "q">("all");
  const [isExpanded, setIsExpanded] = useState(false);

  // 실제 시뮬레이션 history와 editHistory로부터 실시간 전투 이벤트 생성
  const events = useMemo<CombatEvent[]>(() => {
    const list: CombatEvent[] = [];

    // 가장 최근 라운드부터 역순으로 최대 20개 이벤트 수집
    const recentRounds = [...history].reverse().slice(0, 15);
    const editMap = new Map<number, EditHistoryEntry>();
    for (const entry of editHistory) {
      editMap.set(entry.round, entry);
    }

    for (const h of recentRounds) {
      const editEntry = editMap.get(h.round);
      const isReverted = h.edit_reverted;
      const builderActionLabel = getBuilderActionLabel(h.builder_action_name);

      // 1. 시대 스케일업 이벤트
      if (h.era_changed) {
        list.push({
          id: `era-${h.round}`,
          round: h.round,
          era: h.era,
          agent: "system",
          title: `시대 ${h.era} 진화 달성`,
          detail: `미로 크기 ${h.size}×${h.size} 스케일업 · 새로운 고정 경계선 벽 생성`,
          badge: "시대 진화",
          statusColor: "text-amber-300 border-amber-600/60 bg-amber-950/60",
        });
      }

      // 2. Q-Learning 탈출 결과 이벤트
      const successPct = (h.success_rate * 100).toFixed(1);
      const isSuccessDominant = h.success_rate >= 0.7;
      list.push({
        id: `q-${h.round}`,
        round: h.round,
        era: h.era,
        agent: "q",
        title: isSuccessDominant
          ? `Q-Learning 탈출로 돌파 (${successPct}%)`
          : `Q-Learning 경로 탐색 완료 (${successPct}%)`,
        detail: `평균 ${h.avg_steps.toFixed(1)}보 소요 · 초기 적응률 ${(h.early_success_rate * 100).toFixed(1)}% · 보상 ${h.avg_reward.toFixed(1)}`,
        badge: isSuccessDominant ? "돌파 성공" : "탐색 완료",
        statusColor: isSuccessDominant
          ? "text-cyan-200 border-cyan-500/60 bg-cyan-950/60"
          : "text-slate-300 border-slate-700 bg-slate-900/60",
      });

      // 3. SARSA 제작 AI 공격 이벤트
      const editTargetText = editEntry?.edit
        ? formatEditTarget(editEntry.edit)
        : h.builder_action_name
          ? "최단 경로 보호 규칙으로 벽 수정 건너뜀"
          : "초기 배치 유지";

      list.push({
        id: `sarsa-${h.round}`,
        round: h.round,
        era: h.era,
        agent: "sarsa",
        title: isReverted
          ? `SARSA 공격 실패: 수정 되돌림`
          : editEntry?.edit
            ? `SARSA 벽 배치 공격: ${builderActionLabel}`
            : `SARSA 정책 실행: ${builderActionLabel}`,
        detail: isReverted
          ? `출구 차단 또는 최단 경로 단축 위반으로 수정 롤백`
          : `${editTargetText} · 라운드 보상 ${h.builder_reward >= 0 ? "+" : ""}${h.builder_reward.toFixed(2)}`,
        badge: isReverted
          ? "되돌림"
          : editEntry?.edit
            ? "벽 수정"
            : "경로 보존",
        statusColor: isReverted
          ? "text-rose-300 border-rose-600/60 bg-rose-950/60"
          : editEntry?.edit
            ? "text-violet-200 border-violet-500/60 bg-violet-950/60"
            : "text-amber-300 border-amber-600/60 bg-amber-950/60",
        rewardText: `${h.builder_reward >= 0 ? "+" : ""}${h.builder_reward.toFixed(2)}`,
      });
    }

    return list;
  }, [history, editHistory]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.agent === filter);
  }, [events, filter]);

  const displayedEvents = isExpanded ? filteredEvents : filteredEvents.slice(0, 5);

  return (
    <div className="w-full rounded-lg border border-[#1b283d] bg-[#080d18]/95 p-3 shadow-lg">
      {/* 헤더 & 필터 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#182338] pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-950/80 border border-amber-500/50">
            <Swords className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold text-slate-100">
              실시간 AI 공진화 전투 이벤트 로그
            </h3>
            <p className="text-[10px] text-slate-400">
              SARSA 미로 방해 공격 vs Q-Learning 탈출 돌파 라운드 중계
            </p>
          </div>
        </div>

        {/* 필터 세그먼트 버튼 */}
        <div className="flex items-center gap-1 font-mono text-[10.5px]">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded px-2 py-0.5 font-semibold transition-all ${
              filter === "all"
                ? "bg-slate-700 text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            전체 ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("sarsa")}
            className={`rounded px-2 py-0.5 font-semibold transition-all ${
              filter === "sarsa"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-violet-300"
            }`}
          >
            SARSA 공격
          </button>
          <button
            type="button"
            onClick={() => setFilter("q")}
            className={`rounded px-2 py-0.5 font-semibold transition-all ${
              filter === "q"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-cyan-300"
            }`}
          >
            Q-Learning 방어
          </button>
        </div>
      </div>

      {/* 이벤트 피드 목록 */}
      <div className="mt-2.5 space-y-1.5">
        {displayedEvents.length === 0 ? (
          <div className="py-5 text-center font-mono text-xs text-slate-500">
            전투 시뮬레이션을 시작하면 실시간 공격/탈출 로그가 기록됩니다.
          </div>
        ) : (
          displayedEvents.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start justify-between gap-2.5 rounded border border-[#162236] bg-[#070b14] px-2.5 py-1.5 font-mono text-xs transition-colors hover:border-[#223654]"
            >
              <div className="flex items-start gap-2 min-w-0">
                {/* 라운드 뱃지 */}
                <span className="shrink-0 rounded bg-[#0f172a] px-1.5 py-0.5 text-[9.5px] font-bold text-slate-400 border border-slate-800">
                  R{evt.round}
                </span>

                {/* 에이전트 아이콘 */}
                <span className="mt-0.5 shrink-0">
                  {evt.agent === "sarsa" ? (
                    <Brain className="h-3.5 w-3.5 text-violet-400" />
                  ) : evt.agent === "q" ? (
                    <Navigation className="h-3.5 w-3.5 text-cyan-400" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  )}
                </span>

                {/* 텍스트 내용 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200 truncate">
                      {evt.title}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.2 text-[9px] font-bold border ${evt.statusColor}`}
                    >
                      {evt.badge}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 truncate mt-0.5">
                    {evt.detail}
                  </p>
                </div>
              </div>

              {evt.rewardText && (
                <span className="shrink-0 font-bold text-slate-300 text-[11px] tabular-nums">
                  {evt.rewardText}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* 펼치기 / 접기 버튼 */}
      {filteredEvents.length > 5 && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-[#18263d] bg-[#0a101d] py-1 text-center font-mono text-[10.5px] text-slate-400 transition-colors hover:border-sky-500/50 hover:text-slate-200"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
          {isExpanded ? "최근 5개만 보기" : `전체 ${filteredEvents.length}개 로그 펼쳐보기`}
        </button>
      )}
    </div>
  );
}
