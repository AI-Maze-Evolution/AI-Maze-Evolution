"""실제 core/simulation.py 통합 전 웹 UI·API 독립 개발용 DEMO 시뮬레이션 엔진.

docs/interface.md 15번(외부 제어 인터페이스) 규격과 동일한 메서드, 상태 전이,
SimulationState 및 RoundResult 구조를 구현한다.
"""

from __future__ import annotations

from collections import deque
from typing import Any

import numpy as np

import config
from api.schemas import BuilderMode

EMPTY = 0
WALL = 1
DEMO_SEED_OFFSET = 104
ROUNDS_PER_ERA = 12

try:
    from agents.builder import ACTION_NAMES as BUILDER_ACTION_NAMES
except Exception:
    BUILDER_ACTION_NAMES = ("block_hot", "block_path", "random_wall", "remove_wall")


class LocalSimulationStateError(RuntimeError):
    """core.simulation이 없을 때 사용하는 상태 전이 오류 예외."""


def _neighbors(row: int, col: int, size: int) -> list[tuple[int, int]]:
    """격자 범위 내 상하좌우 인접 좌표를 반환한다."""
    result: list[tuple[int, int]] = []
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nr, nc = row + dr, col + dc
        if 0 <= nr < size and 0 <= nc < size:
            result.append((nr, nc))
    return result


def _bfs_shortest_path(grid: np.ndarray) -> list[tuple[int, int]] | None:
    """시작점 (0, 0)에서 출구 (n-1, n-1)까지의 최단 경로를 BFS로 찾아 반환한다."""
    size = grid.shape[0]
    start = (0, 0)
    goal = (size - 1, size - 1)
    if grid[start] != EMPTY or grid[goal] != EMPTY:
        return None
    queue: deque[tuple[int, int]] = deque([start])
    parent: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
    while queue:
        cur = queue.popleft()
        if cur == goal:
            path: list[tuple[int, int]] = []
            node: tuple[int, int] | None = goal
            while node is not None:
                path.append(node)
                node = parent[node]
            path.reverse()
            return path
        for nxt in _neighbors(cur[0], cur[1], size):
            if grid[nxt] == EMPTY and nxt not in parent:
                parent[nxt] = cur
                queue.append(nxt)
    return None


def _distance_to_goal_map(grid: np.ndarray) -> np.ndarray:
    """각 빈칸에서 출구까지의 최단 거리 맵을 계산해 반환한다."""
    size = grid.shape[0]
    goal = (size - 1, size - 1)
    dists = np.full((size, size), fill_value=-1, dtype=int)
    if grid[goal] != EMPTY:
        return dists
    dists[goal] = 0
    queue: deque[tuple[int, int]] = deque([goal])
    while queue:
        r, c = queue.popleft()
        for nr, nc in _neighbors(r, c, size):
            if grid[nr, nc] == EMPTY and dists[nr, nc] == -1:
                dists[nr, nc] = dists[r, c] + 1
                queue.append((nr, nc))
    return dists


class MockSimulationEngine:
    """docs/interface.md 15번 외부 제어 인터페이스를 구현한 합성 DEMO 엔진.

    단일 탈출 AI(Q-Learning)와 제작 AI(SARSA / Rule-Based) 구성을 따르며,
    시대 번호는 1부터 시작한다.
    """

    def __init__(
        self,
        builder_mode: BuilderMode = "sarsa",
        seed: int | None = None,
        state_error_cls: type[RuntimeError] = LocalSimulationStateError,
    ) -> None:
        """builder_mode와 seed를 받아 1시대 idle 상태의 DEMO 엔진을 생성한다."""
        if builder_mode not in ("sarsa", "rule"):
            raise ValueError(f"Unsupported builder_mode: {builder_mode}")
        self._state_error_cls = state_error_cls
        self.era_sizes = [int(s) for s in config.ERA_SIZES]
        self.wall_density = dict(config.WALL_DENSITY)
        self.total_rounds = len(self.era_sizes) * ROUNDS_PER_ERA
        self.builder_mode: BuilderMode = builder_mode
        self.seed: int = int(config.SEED if seed is None else seed)
        self._init_episode_state()

    def _init_episode_state(self) -> None:
        """시드와 builder_mode 기준으로 내부 미로·Q-table·기록을 1시대 idle 상태로 초기화한다."""
        self.rng = np.random.default_rng(self.seed + DEMO_SEED_OFFSET)
        self.status: str = "idle"
        self.round: int = 0
        self.era: int = 1
        self._era_round: int = 0
        self.size: int = self.era_sizes[0]
        self.grid: np.ndarray = self._generate_solvable_maze(self.size)
        self.last_result: dict[str, Any] | None = None
        self.history: list[dict[str, Any]] = []
        self._last_success_rate: float | None = None
        self._last_shortest_len: int | None = None
        self._last_visit_counts: np.ndarray | None = None
        self._builder_q: np.ndarray | None = (
            np.zeros((3, 3, 4), dtype=float) if self.builder_mode == "sarsa" else None
        )
        self._prev_builder_sa: tuple[tuple[int, int], int] | None = None

    def _generate_solvable_maze(self, size: int) -> np.ndarray:
        """주어진 크기의 풀 수 있는 초기 미로를 무작위로 생성해 반환한다."""
        density = float(self.wall_density.get(size, 0.25))
        for _ in range(200):
            grid = (self.rng.random((size, size)) < density).astype(int)
            grid[0, 0] = EMPTY
            grid[size - 1, size - 1] = EMPTY
            path = _bfs_shortest_path(grid)
            if path is not None and len(path) >= 2 * size - 1:
                return grid
        return np.zeros((size, size), dtype=int)

    def _start_goal(self, size: int) -> tuple[list[int], list[int]]:
        """미로 크기에 대한 시작점과 출구 좌표를 [행, 열] 리스트 튜플로 반환한다."""
        return [0, 0], [size - 1, size - 1]

    def is_finished(self) -> bool:
        """시뮬레이션 종료 여부를 bool로 반환한다."""
        return self.status == "finished" or self.round >= self.total_rounds

    def get_state(self) -> dict[str, Any]:
        """docs/interface.md 15-6번 형식의 SimulationState dict를 반환한다."""
        start, goal = self._start_goal(self.size)
        return {
            "status": self.status,
            "builder_mode": self.builder_mode,
            "seed": self.seed,
            "round": self.round,
            "era": self.era,
            "size": self.size,
            "start": start,
            "goal": goal,
            "grid": self.grid.tolist(),
            "finished": self.is_finished(),
            "last_result": self.last_result,
            "history": list(self.history),
        }

    def start(self) -> dict[str, Any]:
        """idle 상태에서 running 상태로 전환하고 SimulationState를 반환한다."""
        if self.status != "idle":
            raise self._state_error_cls(f"Cannot start simulation from status '{self.status}'")
        self.status = "running"
        return self.get_state()

    def pause(self) -> dict[str, Any]:
        """running 상태에서 paused 상태로 전환하고 SimulationState를 반환한다."""
        if self.status != "running":
            raise self._state_error_cls(f"Cannot pause simulation from status '{self.status}'")
        self.status = "paused"
        return self.get_state()

    def resume(self) -> dict[str, Any]:
        """paused 상태에서 running 상태로 전환하고 SimulationState를 반환한다."""
        if self.status != "paused":
            raise self._state_error_cls(f"Cannot resume simulation from status '{self.status}'")
        self.status = "running"
        return self.get_state()

    def reset(
        self,
        builder_mode: BuilderMode | None = None,
        seed: int | None = None,
    ) -> dict[str, Any]:
        """미로, Q-table, 기록을 모두 초기화하고 1시대 idle 상태의 SimulationState를 반환한다."""
        if builder_mode is not None:
            if builder_mode not in ("sarsa", "rule"):
                raise ValueError(f"Unsupported builder_mode: {builder_mode}")
            self.builder_mode = builder_mode
        if seed is not None:
            self.seed = int(seed)
        self._init_episode_state()
        return self.get_state()

    def _compute_builder_state(self, size: int, shortest_len: int) -> tuple[int, int]:
        """직전 성공률과 최단 경로 비율로 3×3 제작 AI 상태 인덱스를 계산한다."""
        prev_rate = self._last_success_rate if self._last_success_rate is not None else 0.4
        if prev_rate < config.BUILDER_TARGET_LOW:
            rate_bin = 0
        elif prev_rate <= config.BUILDER_TARGET_HIGH:
            rate_bin = 1
        else:
            rate_bin = 2
        ratio = shortest_len / max(1, 2 * size - 2)
        path_bin = 0 if ratio <= 1.2 else (1 if ratio <= 1.6 else 2)
        return (rate_bin, path_bin)

    def _select_builder_action(self, state: tuple[int, int]) -> int:
        """builder_mode(sarsa/rule)에 따라 제작 AI 행동 번호(0~3)를 선택한다."""
        if self.builder_mode == "rule":
            rate_bin, path_bin = state
            if rate_bin == 0:
                return 3  # remove_wall
            if rate_bin == 2:
                return 1 if path_bin == 0 else 0  # block_path / block_hot
            return 2  # random_wall

        assert self._builder_q is not None
        if self.rng.random() < config.BUILDER_EPSILON:
            return int(self.rng.integers(0, 4))
        q_vals = self._builder_q[state[0], state[1]]
        max_q = float(np.max(q_vals))
        best = [idx for idx, val in enumerate(q_vals) if abs(float(val) - max_q) < 1e-9]
        return int(best[int(self.rng.integers(0, len(best)))])

    def _apply_builder_action(
        self,
        grid: np.ndarray,
        action: int,
        shortest: list[tuple[int, int]],
        era_round: int,
    ) -> tuple[dict[str, Any] | None, np.ndarray, bool]:
        """선택된 행동 번호에 따라 유효한 미로 수정안을 적용하고 결과를 반환한다."""
        size = grid.shape[0]
        start = (0, 0)
        goal = (size - 1, size - 1)
        prev_rate = self._last_success_rate if self._last_success_rate is not None else 0.4
        simulate_revert = era_round in (6, 10) and prev_rate > 0.45 and action != 3

        wall_cells = [
            (r, c)
            for r in range(size)
            for c in range(size)
            if grid[r, c] == WALL and (r, c) not in (start, goal)
        ]
        empty_cells = [
            (r, c)
            for r in range(size)
            for c in range(size)
            if grid[r, c] == EMPTY and (r, c) not in (start, goal)
        ]

        if action == 3:
            if not wall_cells:
                return None, grid.copy(), False
            pos = wall_cells[int(self.rng.integers(0, len(wall_cells)))]
            candidate = grid.copy()
            candidate[pos] = EMPTY
            return {"type": "remove_wall", "pos": [int(pos[0]), int(pos[1])]}, candidate, False

        candidates: list[tuple[int, int]]
        if action == 0 and self._last_visit_counts is not None and self._last_visit_counts.shape == grid.shape:
            candidates = sorted(
                empty_cells,
                key=lambda cell: int(self._last_visit_counts[cell[0], cell[1]]),
                reverse=True,
            )
        elif action == 1:
            candidates = [pos for pos in shortest[1:-1] if pos not in (start, goal)] + empty_cells
        else:
            order = self.rng.permutation(len(empty_cells))
            candidates = [empty_cells[int(i)] for i in order]

        for pos in candidates[: min(8, len(candidates))]:
            candidate = grid.copy()
            candidate[pos] = WALL
            if _bfs_shortest_path(candidate) is not None:
                edit = {"type": "add_wall", "pos": [int(pos[0]), int(pos[1])]}
                if simulate_revert:
                    return edit, grid.copy(), True
                return edit, candidate, False

        return None, grid.copy(), False

    def _build_q_heatmap(self, grid: np.ndarray, progress: float) -> list[list[float]]:
        """출구까지의 거리 기반으로 Q-Learning 최대 Q값 히트맵을 생성한다."""
        size = grid.shape[0]
        dists = _distance_to_goal_map(grid)
        max_dist = max(1, int(np.max(dists)))
        q_map = np.zeros((size, size), dtype=float)
        for r in range(size):
            for c in range(size):
                if grid[r, c] != EMPTY or dists[r, c] < 0:
                    q_map[r, c] = 0.0
                else:
                    closeness = 1.0 - (dists[r, c] / (max_dist + 1))
                    noise = float(self.rng.normal(0.0, 1.4))
                    val = (
                        config.REWARD_GOAL
                        * (config.GAMMA ** dists[r, c])
                        * (0.25 + 0.75 * progress)
                        + closeness * 4.0
                        + noise
                    )
                    q_map[r, c] = round(float(val), 2)
        return q_map.tolist()

    def step(self) -> dict[str, Any]:
        """한 라운드를 실행하고 docs/interface.md 15-5번 형식의 RoundResult를 반환한다."""
        if self.status == "finished" or self.is_finished():
            raise self._state_error_cls("Cannot step simulation when status is 'finished'")

        self.round += 1
        self._era_round += 1
        current_era = self.era
        current_size = self.size
        start, goal = self._start_goal(current_size)
        progress = self._era_round / ROUNDS_PER_ERA

        base_shortest = _bfs_shortest_path(self.grid)
        assert base_shortest is not None
        builder_state = self._compute_builder_state(current_size, len(base_shortest) - 1)

        if self._era_round == 1:
            builder_action: int | None = None
            builder_action_name: str | None = None
            edit: dict[str, Any] | None = None
            round_grid = self.grid.copy()
            edit_reverted = False
        else:
            builder_action = self._select_builder_action(builder_state)
            builder_action_name = str(BUILDER_ACTION_NAMES[builder_action])
            edit, round_grid, edit_reverted = self._apply_builder_action(
                self.grid, builder_action, base_shortest, self._era_round
            )

        self.grid = round_grid
        path_q = _bfs_shortest_path(round_grid)
        assert path_q is not None
        shortest_len = len(path_q) - 1

        era_difficulty = 0.055 * (current_era - 1)
        edit_shock = 0.085 if (edit is not None and edit["type"] == "add_wall" and not edit_reverted) else 0.0

        if edit_reverted:
            q_success = 0.0
            q_early = 0.0
        else:
            q_success = float(
                np.clip(
                    0.24 + 0.68 * (progress**0.82) - era_difficulty - edit_shock + float(self.rng.normal(0.0, 0.03)),
                    0.05,
                    0.98,
                )
            )
            q_early = float(
                np.clip(
                    q_success - 0.13 - edit_shock * 0.7 + float(self.rng.normal(0.0, 0.025)),
                    0.0,
                    0.95,
                )
            )

        max_steps = config.MAX_STEPS_FACTOR * current_size * current_size
        q_steps = round(
            float(
                min(
                    max_steps,
                    max(
                        shortest_len,
                        shortest_len * (1.08 + (1.0 - q_success) * 1.45) + float(self.rng.uniform(0.0, 1.2)),
                    ),
                )
            ),
            2,
        )
        q_reward = round(
            float(
                q_success * config.REWARD_GOAL
                + (1.0 - q_success) * config.REWARD_TIMEOUT
                + q_steps * config.REWARD_STEP
                + (1.0 - q_success) * config.REWARD_WALL_BUMP * 2.5
            ),
            2,
        )

        visits = np.zeros((current_size, current_size), dtype=int)
        for r in range(current_size):
            for c in range(current_size):
                if round_grid[r, c] == EMPTY:
                    visits[r, c] = int(self.rng.integers(1, 8))
        boost = int(12 + 38 * q_success)
        for r, c in path_q:
            visits[r, c] += boost + int(self.rng.integers(0, 6))

        # 제작 AI 보상 계산 및 SARSA Q-table 업데이트
        if edit_reverted:
            builder_reward = -1.0
        elif config.BUILDER_TARGET_LOW <= q_success <= config.BUILDER_TARGET_HIGH:
            builder_reward = 1.0
        elif q_success > config.BUILDER_TARGET_HIGH:
            builder_reward = 0.0
        else:
            builder_reward = -0.5
        if self._last_shortest_len is not None and shortest_len > self._last_shortest_len and not edit_reverted:
            builder_reward += 0.2
        builder_reward = round(float(builder_reward), 3)

        if self._builder_q is not None and builder_action is not None:
            next_state = self._compute_builder_state(current_size, shortest_len)
            next_action = self._select_builder_action(next_state)
            if self._prev_builder_sa is not None:
                ps, pa = self._prev_builder_sa
                cur_q = float(self._builder_q[ps[0], ps[1], pa])
                nxt_q = float(self._builder_q[builder_state[0], builder_state[1], builder_action])
                self._builder_q[ps[0], ps[1], pa] = round(
                    cur_q + config.BUILDER_ALPHA * (builder_reward + config.BUILDER_GAMMA * nxt_q - cur_q),
                    4,
                )
            else:
                cur_q = float(self._builder_q[builder_state[0], builder_state[1], builder_action])
                nxt_q = float(self._builder_q[next_state[0], next_state[1], next_action])
                self._builder_q[builder_state[0], builder_state[1], builder_action] = round(
                    cur_q + config.BUILDER_ALPHA * (builder_reward + config.BUILDER_GAMMA * nxt_q - cur_q),
                    4,
                )
            self._prev_builder_sa = (builder_state, builder_action)

        era_changed = self._era_round >= ROUNDS_PER_ERA and current_era < len(self.era_sizes)
        next_size = self.era_sizes[current_era] if era_changed else None
        finished = self.round >= self.total_rounds
        if finished:
            self.status = "finished"

        report_q = {
            "algo": "q",
            "n_episodes": int(config.ROUND_EPISODES),
            "success_rate": round(q_success, 4),
            "early_success_rate": round(q_early, 4),
            "trap_rate": 0.0,
            "avg_steps": q_steps,
            "avg_reward": q_reward,
            "visit_counts": visits.tolist(),
            "shortest_path_len": shortest_len,
        }

        result: dict[str, Any] = {
            "round": self.round,
            "era": current_era,
            "size": current_size,
            "start": start,
            "goal": goal,
            "grid": round_grid.tolist(),
            "edit": edit,
            "edit_reverted": edit_reverted,
            "reports": {"q": report_q},
            "best_paths": {"q": [[int(r), int(c)] for r, c in path_q]},
            "q_values_max": {"q": self._build_q_heatmap(round_grid, progress)},
            "builder_mode": self.builder_mode,
            "builder_state": [int(builder_state[0]), int(builder_state[1])],
            "builder_action": builder_action,
            "builder_action_name": builder_action_name,
            "builder_reward": builder_reward,
            "builder_q_table": self._builder_q.tolist() if self._builder_q is not None else None,
            "era_changed": era_changed,
            "next_size": next_size,
            "finished": finished,
        }

        self.last_result = result
        self.history.append(
            {
                "round": self.round,
                "era": current_era,
                "size": current_size,
                "success_rate": report_q["success_rate"],
                "early_success_rate": report_q["early_success_rate"],
                "avg_reward": report_q["avg_reward"],
                "avg_steps": report_q["avg_steps"],
                "builder_reward": builder_reward,
                "builder_action_name": builder_action_name,
                "edit_type": edit["type"] if edit is not None else None,
                "edit_reverted": edit_reverted,
                "era_changed": era_changed,
            }
        )

        self._last_success_rate = report_q["success_rate"]
        self._last_shortest_len = shortest_len
        self._last_visit_counts = visits

        # 시대 전환 시 다음 라운드용 새 미로를 준비한다 (last_result.grid는 방금 실행한 미로 유지)
        if era_changed and next_size is not None:
            self.era += 1
            self._era_round = 0
            self.size = next_size
            self.grid = self._generate_solvable_maze(next_size)
            self._last_success_rate = None
            self._last_shortest_len = None
            self._last_visit_counts = None

        return result
