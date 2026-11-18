import type {
  ConnectionStatus,
  EngineMode,
  SimulationStatus,
} from "../types/simulation";

interface HeaderProps {
  mode: EngineMode;
  status: SimulationStatus;
  era: number;
  round: number;
  size: number;
  seed: number;
  connectionStatus: ConnectionStatus;
}

const STATUS_STYLE: Record<SimulationStatus, { label: string; dot: string; text: string }> = {
  idle: { label: "대기 중", dot: "bg-slate-400", text: "text-slate-300" },
  running: { label: "실행 중", dot: "bg-emerald-400 animate-pulse", text: "text-emerald-300" },
  paused: { label: "일시정지", dot: "bg-amber-400", text: "text-amber-300" },
  finished: { label: "완료", dot: "bg-sky-400", text: "text-sky-300" },
  error: { label: "오류", dot: "bg-rose-500", text: "text-rose-300" },
};

const WS_STYLE: Record<ConnectionStatus, { label: string; dot: string; border: string; text: string }> = {
  connected: {
    label: "실시간 연결됨",
    dot: "bg-emerald-400",
    border: "border-emerald-800/70 bg-emerald-950/40",
    text: "text-emerald-300",
  },
  connecting: {
    label: "서버 연결 대기 중",
    dot: "bg-sky-400 animate-pulse",
    border: "border-sky-800/70 bg-sky-950/40",
    text: "text-sky-300",
  },
  reconnecting: {
    label: "실시간 재연결 중",
    dot: "bg-amber-400 animate-pulse",
    border: "border-amber-800/70 bg-amber-950/40",
    text: "text-amber-300",
  },
  disconnected: {
    label: "실시간 연결 끊김",
    dot: "bg-rose-500",
    border: "border-rose-800/70 bg-rose-950/40",
    text: "text-rose-300",
  },
};

export function Header({
  mode,
  status,
  era,
  round,
  size,
  seed,
  connectionStatus,
}: HeaderProps) {
  const st = STATUS_STYLE[status];
  const ws = WS_STYLE[connectionStatus];

  return (
    <header className="sticky top-0 z-30 border-b border-lab-border bg-lab-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border border-sky-500/40 bg-lab-surface">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" fill="none" stroke="#38bdf8" strokeWidth="1.8" />
              <path d="M2 10H10V6H16V14H8V22" fill="none" stroke="#a78bfa" strokeWidth="1.8" />
              <circle cx="6" cy="6" r="1.8" fill="#10b981" />
              <circle cx="18" cy="18" r="1.8" fill="#f59e0b" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-sm font-bold tracking-[0.12em] text-slate-100">
                AI MAZE EVOLUTION
              </h1>
              <span
                className={`border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${
                  mode === "DEMO"
                    ? "border-amber-600/60 bg-amber-950/60 text-amber-300"
                    : "border-emerald-600/60 bg-emerald-950/60 text-emerald-300"
                }`}
              >
                {mode === "DEMO" ? "데모 모드 · 합성 데이터" : "실시간 강화학습 엔진"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              SARSA 미로 제작 AI와 Q-Learning 탈출 AI 경쟁 학습 시뮬레이터
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
          <div
            className="flex items-center gap-1.5 border border-lab-border bg-lab-surface px-2.5 py-1"
            title="현재 시뮬레이션 상태"
          >
            <span className={`h-2 w-2 rounded-full ${st.dot}`} />
            <span className="text-[10px] text-slate-500">상태</span>
            <span className={`font-semibold ${st.text}`}>{st.label}</span>
          </div>

          <div className="flex items-center gap-3 border border-lab-border bg-lab-surface px-2.5 py-1">
            <div>
              <span className="mr-1.5 text-[10px] text-slate-500">시대</span>
              <span className="font-semibold text-slate-100">{era}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div>
              <span className="mr-1.5 text-[10px] text-slate-500">라운드</span>
              <span className="font-semibold text-slate-100">{round}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div>
              <span className="mr-1.5 text-[10px] text-slate-500">다음 미로</span>
              <span className="font-semibold text-sky-300">
                {size}×{size}
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div>
              <span className="mr-1.5 text-[10px] text-slate-500">시드</span>
              <span className="font-semibold text-slate-200">{seed}</span>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 border px-2.5 py-1 ${ws.border}`}
            title="실시간 연결 상태"
          >
            <span className={`h-2 w-2 rounded-full ${ws.dot}`} />
            <span className={`text-[11px] font-semibold ${ws.text}`}>{ws.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
