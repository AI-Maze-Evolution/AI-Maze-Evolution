import { Cpu, Radio, Sparkles } from "lucide-react";
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

const STATUS_STYLE: Record<
  SimulationStatus,
  { label: string; dot: string; glow: string; text: string; bg: string; border: string }
> = {
  idle: {
    label: "대기 중",
    dot: "bg-slate-400",
    glow: "",
    text: "text-slate-300",
    bg: "bg-slate-900/60",
    border: "border-slate-700/60",
  },
  running: {
    label: "연산 실행 중",
    dot: "bg-emerald-400 animate-ping",
    glow: "shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    text: "text-emerald-300 font-semibold",
    bg: "bg-emerald-950/40",
    border: "border-emerald-600/50",
  },
  paused: {
    label: "일시정지",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_8px_rgba(251,191,36,0.5)]",
    text: "text-amber-300",
    bg: "bg-amber-950/40",
    border: "border-amber-600/50",
  },
  finished: {
    label: "시뮬레이션 완료",
    dot: "bg-sky-400",
    glow: "shadow-[0_0_8px_rgba(56,189,248,0.5)]",
    text: "text-sky-300",
    bg: "bg-sky-950/40",
    border: "border-sky-600/50",
  },
  error: {
    label: "오류 발생",
    dot: "bg-rose-500 animate-pulse",
    glow: "shadow-[0_0_8px_rgba(244,63,94,0.6)]",
    text: "text-rose-300",
    bg: "bg-rose-950/40",
    border: "border-rose-600/60",
  },
};

const WS_STYLE: Record<
  ConnectionStatus,
  { label: string; dot: string; border: string; text: string; bg: string }
> = {
  connected: {
    label: "실시간 동기화됨",
    dot: "bg-emerald-400",
    border: "border-emerald-700/60",
    bg: "bg-emerald-950/30",
    text: "text-emerald-300",
  },
  connecting: {
    label: "서버 연결 시도 중",
    dot: "bg-sky-400 animate-pulse",
    border: "border-sky-700/60",
    bg: "bg-sky-950/30",
    text: "text-sky-300",
  },
  reconnecting: {
    label: "재연결 중…",
    dot: "bg-amber-400 animate-pulse",
    border: "border-amber-700/60",
    bg: "bg-amber-950/30",
    text: "text-amber-300",
  },
  disconnected: {
    label: "연결 해제됨",
    dot: "bg-rose-500",
    border: "border-rose-700/60",
    bg: "bg-rose-950/30",
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
    <header className="sticky top-0 z-40 border-b border-[#1b263b] bg-[#070b13]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* 로고 & 시스템 타이틀 */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded border border-sky-500/40 bg-[#0c1422] shadow-[0_0_12px_rgba(56,189,248,0.18)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="2" fill="none" stroke="#38bdf8" strokeWidth="1.6" />
              <path d="M2 10H10V6H16V14H8V22" fill="none" stroke="#a78bfa" strokeWidth="1.6" />
              <circle cx="6" cy="6" r="1.8" fill="#10b981" />
              <circle cx="18" cy="18" r="1.8" fill="#f59e0b" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
              <span className="h-2 w-2 rounded-full bg-sky-400 ring-2 ring-[#070b13]" />
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-sm font-extrabold tracking-[0.14em] text-slate-100">
                AI MAZE EVOLUTION
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${
                  mode === "DEMO"
                    ? "border-amber-500/50 bg-amber-950/50 text-amber-300"
                    : "border-emerald-500/50 bg-emerald-950/50 text-emerald-300"
                }`}
              >
                {mode === "DEMO" ? (
                  <>
                    <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                    데모 모드 · 고정 경계선 벽
                  </>
                ) : (
                  <>
                    <Cpu className="h-2.5 w-2.5 text-emerald-400" />
                    실시간 강화학습 엔진
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              SARSA 미로 제작 AI × Q-Learning 탈출 AI 적대적 공진화 연구 시뮬레이터
            </p>
          </div>
        </div>

        {/* 실시간 텔레메트리 스트립 */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
          {/* 실행 상태 LED */}
          <div
            className={`flex items-center gap-2 rounded border px-3 py-1 ${st.bg} ${st.border}`}
            title="현재 시뮬레이션 상태"
          >
            <div className="relative flex h-2 w-2 items-center justify-center">
              <span className={`h-2 w-2 rounded-full ${st.dot} ${st.glow}`} />
            </div>
            <span className="text-[10px] text-slate-400">상태</span>
            <span className={`text-[11px] ${st.text}`}>{st.label}</span>
          </div>

          {/* 시대 / 라운드 / 미로 크기 / 시드 계측 정보 */}
          <div className="flex items-center gap-3 rounded border border-[#1e2c44] bg-[#0c1320] px-3 py-1 shadow-inner">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">시대</span>
              <span className="font-bold text-sky-300">{era}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">라운드</span>
              <span className="font-bold text-slate-100">{round}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">격자 크기</span>
              <span className="font-bold text-violet-300">
                {size}×{size}
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">시드</span>
              <span className="font-medium text-slate-300">{seed}</span>
            </div>
          </div>

          {/* WebSocket 상태 */}
          <div
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 ${ws.border} ${ws.bg}`}
            title="백엔드 WebSocket 실시간 채널"
          >
            <Radio className="h-3 w-3 text-emerald-400" />
            <span className={`text-[11px] font-medium ${ws.text}`}>{ws.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
