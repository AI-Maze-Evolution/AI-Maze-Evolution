export type EngineMode = "DEMO" | "REAL";
export type RequestedEngineMode = "auto" | "demo" | "real";
export type BuilderMode = "sarsa" | "rule";
export type SimulationStatus = "idle" | "running" | "paused" | "finished" | "error";
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
export type OverlayMode = "paths" | "q_heatmap" | "visits";
export type BuilderActionName =
  | "block_hot"
  | "block_path"
  | "move_to_path"
  | "move_to_hot"
  | "random_wall"
  | "remove_wall";

export type Coord = [number, number];

export interface MazeEdit {
  type: "add_wall" | "remove_wall" | "move_wall" | "add_trap" | "remove_trap";
  pos?: unknown;
  from?: unknown;
  to?: unknown;
  wall?: unknown;
  edge?: unknown;
}

export interface SolverReport {
  algo: "q";
  n_episodes: number;
  success_rate: number;
  early_success_rate: number;
  trap_rate: number;
  avg_steps: number;
  avg_reward: number;
  visit_counts: number[][];
  shortest_path_len: number | null;
}

export interface RoundResult {
  round: number;
  era: number;
  size: number;
  start: Coord;
  goal: Coord;
  grid: number[][];
  walls?: unknown;
  edit: MazeEdit | null;
  edit_reverted: boolean;
  reports: {
    q: SolverReport;
  };
  best_paths: {
    q: Coord[];
  };
  q_values_max: {
    q: number[][];
  };
  builder_mode: BuilderMode;
  builder_state: [number, number] | null;
  builder_action: number | null;
  builder_action_name: string | null;
  builder_reward: number;
  builder_q_table: number[][][] | null;
  era_changed: boolean;
  next_size: number | null;
  finished: boolean;
}

export interface HistoryItem {
  round: number;
  era: number;
  size: number;
  success_rate: number;
  early_success_rate: number;
  avg_reward: number;
  avg_steps: number;
  builder_reward: number;
  builder_action_name: string | null;
  edit_type: string | null;
  edit_reverted: boolean;
  era_changed: boolean;
}

export interface EditHistoryEntry {
  round: number;
  era: number;
  size: number;
  edit: MazeEdit | null;
  edit_type: string | null;
  edit_reverted: boolean;
  builder_state: [number, number] | null;
  builder_action: number | null;
  builder_action_name: string | null;
  builder_reward: number;
  success_rate: number;
  shortest_path_len: number | null;
}

export interface SimulationState {
  status: SimulationStatus;
  builder_mode: BuilderMode;
  seed: number;
  round: number;
  era: number;
  size: number;
  start: Coord;
  goal: Coord;
  grid: number[][];
  walls?: unknown;
  finished: boolean;
  last_result: RoundResult | null;
  history: HistoryItem[];

  mode: EngineMode;
  engine_available: boolean;
  speed: number;
  era_sizes: number[];
  prev_grid: number[][] | null;
  prev_walls?: unknown;
  edit_history: EditHistoryEntry[];
  era_transitions: number[];
  error: string | null;
}

export interface HealthStatus {
  status: "ok";
  mode: EngineMode;
  engine_available: boolean;
  simulation_status: SimulationStatus;
  active_connections: number;
}

export interface RoundUpdatePayload {
  mode: EngineMode;
  status: SimulationStatus;
  result: RoundResult;
  next_grid: number[][];
  next_walls?: unknown;
  next_era: number;
  next_size: number;
  next_start: Coord;
  next_goal: Coord;
  finished: boolean;
  prev_grid: number[][] | null;
  prev_walls?: unknown;
  history_item: HistoryItem;
  edit_record: EditHistoryEntry;
  era_transitions: number[];
}

export interface StatusChangePayload {
  mode: EngineMode;
  status: SimulationStatus;
  builder_mode: BuilderMode;
  seed: number;
  speed: number;
  round: number;
  era: number;
  size: number;
  finished: boolean;
  error: string | null;
}

export type ServerMessage =
  | { type: "state_snapshot"; timestamp: string; data: SimulationState }
  | { type: "round_update"; timestamp: string; data: RoundUpdatePayload }
  | { type: "status_change"; timestamp: string; data: StatusChangePayload }
  | { type: "error"; timestamp: string; message: string }
  | { type: "pong"; timestamp: string };

export interface DerivedAction {
  code: number | null;
  label: string;
  direction: string;
}

export const BUILDER_ACTION_LABELS: Record<string, string> = {
  block_hot: "최다 방문 차단",
  block_path: "최단 경로 차단",
  move_to_path: "경로로 벽 이동",
  move_to_hot: "최다 방문으로 이동",
  random_wall: "무작위 벽 추가",
  remove_wall: "무작위 벽 제거",
};

export function getBuilderActionLabel(name: string | null | undefined): string {
  if (!name) return "—";
  return BUILDER_ACTION_LABELS[name] ?? name;
}

/**
 * docs/interface.md 3번 행동 번호(0:상, 1:하, 2:좌, 3:우)에 따라
 * best_paths.q 연속 좌표 변화로부터 이동 행동을 계산한다.
 */
export function deriveActionFromPath(
  path: Coord[],
  stepIndex: number,
  goal: Coord,
): DerivedAction {
  if (!path.length) {
    return { code: null, label: "대기 중", direction: "—" };
  }
  const clamped = Math.min(stepIndex, path.length - 1);
  const current = path[clamped];
  if (current[0] === goal[0] && current[1] === goal[1]) {
    return { code: null, label: "도착", direction: "도착" };
  }
  if (clamped + 1 >= path.length) {
    return { code: null, label: "종료", direction: "종료" };
  }
  const next = path[clamped + 1];
  const dr = next[0] - current[0];
  const dc = next[1] - current[1];
  if (dr === -1 && dc === 0) return { code: 0, label: "0 · 상", direction: "상" };
  if (dr === 1 && dc === 0) return { code: 1, label: "1 · 하", direction: "하" };
  if (dr === 0 && dc === -1) return { code: 2, label: "2 · 좌", direction: "좌" };
  if (dr === 0 && dc === 1) return { code: 3, label: "3 · 우", direction: "우" };
  return { code: null, label: "유지", direction: "유지" };
}
