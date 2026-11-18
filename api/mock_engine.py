"""실제 core/simulation.py 통합 전·데모 검증용 합성 시뮬레이션 엔진.

docs/interface.md 15번 규격과 경계선 벽(이웃 두 칸 사이 양방향 차단),
시대별 고정 시작점·도착점·초기 벽 개수(5×5: 10개, 7×7: 25개, 10×10: 50개)를 구현한다.
"""

from __future__ import annotations

from collections import deque
from typing import Any

import numpy as np

import config
from api.schemas import BuilderMode

EMPTY = 0
DEMO_SEED_OFFSET = 104
ROUNDS_PER_ERA = 12
INITIAL_EDGE_WALL_COUNTS = {5: 10, 7: 25, 10: 50}
BUILDER_ACTION_NAMES = ("block_hot", "block_path", "move_to_path", "move_to_hot")

Edge = tuple[tuple[int, int], tuple[int, int]]


class LocalSimulationStateError(RuntimeError):
    """core.simulation이 없을 때 사용하는 상태 전이 오류 예외."""


def _canonical_edge(a: tuple[int, int], b: tuple[int, int]) -> Edge:
    """두 인접 칸 좌표를 정규화된 양방향 간선 튜플로 반환한다."""
    return (a, b) if a <= b else (b, a)


def _all_internal_edges(size: int) -> list[Edge]:
    """size×size 격자 내 모든 인접 칸 경계선 목록을 반환한다."""
    edges: list[Edge] = []
    for r in range(size):
        for c in range(size):
            if c + 1 < size:
                edges.append(((r, c), (r, c + 1)))
            if r + 1 < size:
                edges.append(((r, c), (r + 1, c)))
    return edges


def _neighbors_open(
    row: int,
    col: int,
    size: int,
    walls: set[Edge],
) -> list[tuple[int, int]]:
    """경계선 벽으로 막히지 않은 상하좌우 인접 칸 좌표를 반환한다."""
    result: list[tuple[int, int]] = []
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nr, nc = row + dr, col + dc
        if 0 <= nr < size and 0 <= nc < size:
            if _canonical_edge((row, col), (nr, nc)) not in walls:
                result.append((nr, nc))
    return result


def _bfs_shortest_path_edges(
    size: int,
    start: tuple[int, int],
    goal: tuple[int, int],
    walls: set[Edge],
) -> list[tuple[int, int]] | None:
    """경계선 벽 집합을 기준으로 start에서 goal까지의 최단 경로를 반환한다."""
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
        for nxt in _neighbors_open(cur[0], cur[1], size, walls):
            if nxt not in parent:
                parent[nxt] = cur
                queue.append(nxt)
    return None


def _distance_to_goal_edges(
    size: int,
    goal: tuple[int, int],
    walls: set[Edge],
) -> np.ndarray:
    """각 칸에서 goal까지의 최단 이동 거리를 경계선 벽 기준으로 계산한다."""
    dists = np.full((size, size), fill_value=-1, dtype=int)
    dists[goal] = 0
    queue: deque[tuple[int, int]] = deque([goal])
    while queue:
        r, c = queue.popleft()
        for nr, nc in _neighbors_open(r, c, size, walls):
            if dists[nr, nc] == -1:
                dists[nr, nc] = dists[r, c] + 1
                queue.append((nr, nc))
    return dists


def _fixed_era_layout(size: int) -> tuple[tuple[int, int], tuple[int, int], set[Edge]]:
    """시대별 고정 시작점·도착점과 고정 초기 경계선 벽(10/25/50개) 배치를 반환한다."""
    try:
        from core.passage_maze import get_fixed_maze

        fixed = get_fixed_maze(size)
        return tuple(fixed.start), tuple(fixed.goal), set(fixed.walls)
    except (ModuleNotFoundError, ImportError, KeyError):
        pass

    start = (0, 0)
    goal = (size - 1, size - 1)
    target_walls = INITIAL_EDGE_WALL_COUNTS.get(size, max(4, (size * size) // 2))
    layout_rng = np.random.default_rng(1000 + size * 31)
    all_edges = _all_internal_edges(size)
    order = layout_rng.permutation(len(all_edges))
    walls: set[Edge] = set()
    for idx in order:
        if len(walls) >= target_walls:
            break
        edge = all_edges[int(idx)]
        walls.add(edge)
        if _bfs_shortest_path_edges(size, start, goal, walls) is None:
            walls.remove(edge)
    return start, goal, walls


def _serialize_walls(walls: set[Edge]) -> list[list[list[int]]]:
    """경계선 벽 집합을 정렬된 [[[r1, c1], [r2, c2]], ...] 리스트로 변환한다."""
    return [[[a[0], a[1]], [b[0], b[1]]] for a, b in sorted(walls)]


class MockSimulationEngine:
    """docs/interface.md 15번 규격 + 경계선 벽 고정 초기 배치를 구현한 DEMO 엔진."""

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
        self.total_rounds = len(self.era_sizes) * ROUNDS_PER_ERA
        self.builder_mode: BuilderMode = builder_mode
        self.seed: int = int(config.SEED if seed is None else seed)
        self._init_episode_state()

    def _load_era_fixed_maze(self, size: int) -> None:
        """주어진 크기의 고정 시작점·도착점·초기 벽 배치를 적재한다."""
        start, goal, walls = _fixed_era_layout(size)
        self.size = size
        self.start = start
        self.goal = goal
        self.grid = np.zeros((size, size), dtype=int)
        self.walls: set[Edge] = set(walls)

    def _init_episode_state(self) -> None:
        """내부 미로·Q-table·기록을 1시대 고정 초기 배치의 idle 상태로 초기화한다."""
        self.rng = np.random.default_rng(self.seed + DEMO_SEED_OFFSET)
        self.status: str = "idle"
        self.round: int = 0
        self.era: int = 1
        self._era_round: int = 0
        self._load_era_fixed_maze(self.era_sizes[0])
        self.last_result: dict[str, Any] | None = None
        self.history: list[dict[str, Any]] = []
        self._last_success_rate: float | None = None
        self._last_shortest_len: int | None = None
        self._last_visit_counts: np.ndarray | None = None
        self._builder_q: np.ndarray | None = (
            np.zeros((3, 3, 4), dtype=float) if self.builder_mode == "sarsa" else None
        )
        self._prev_builder_sa: tuple[tuple[int, int], int] | None = None

    def is_finished(self) -> bool:
        """시뮬레이션 종료 여부를 bool로 반환한다."""
        return self.status == "finished" or self.round >= self.total_rounds

    def get_state(self) -> dict[str, Any]:
        """docs/interface.md 15-6번 형식의 SimulationState dict를 반환한다."""
        return {
            "status": self.status,
            "builder_mode": self.builder_mode,
            "seed": self.seed,
            "round": self.round,
            "era": self.era,
            "size": self.size,
            "start": [self.start[0], self.start[1]],
            "goal": [self.goal[0], self.goal[1]],
            "grid": self.grid.tolist(),
            "walls": _serialize_walls(self.walls),
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
        """미로·Q-table·기록을 모두 초기화하고 1시대 고정 배치의 SimulationState를 반환한다."""
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
        rate_bin = 0 if prev_rate < config.BUILDER_TARGET_LOW else (1 if prev_rate <= config.BUILDER_TARGET_HIGH else 2)
        ratio = shortest_len / max(1, 2 * size - 2)
        path_bin = 0 if ratio <= 1.2 else (1 if ratio <= 1.6 else 2)
        return (rate_bin, path_bin)

    def _select_builder_action(self, state: tuple[int, int]) -> int:
        """builder_mode에 따라 제작 AI 행동 번호(0~3)를 선택한다."""
        if self.builder_mode == "rule":
            rate_bin, path_bin = state
            if rate_bin == 2:
                return 1 if path_bin == 0 else 0
            return 2 if path_bin == 0 else 3

        assert self._builder_q is not None
        if self.rng.random() < config.BUILDER_EPSILON:
            return int(self.rng.integers(0, 4))
        q_vals = self._builder_q[state[0], state[1]]
        max_q = float(np.max(q_vals))
        best = [idx for idx, val in enumerate(q_vals) if abs(float(val) - max_q) < 1e-9]
        return int(best[int(self.rng.integers(0, len(best)))])

    def _apply_builder_edge_action(
        self,
        action: int,
        shortest: list[tuple[int, int]],
        era_round: int,
    ) -> tuple[dict[str, Any] | None, set[Edge], bool]:
        """선택된 행동 번호에 따라 경계선 벽 추가 또는 이동을 적용한다."""
        all_edges = _all_internal_edges(self.size)
        open_edges = [e for e in all_edges if e not in self.walls]
        path_edges = [
            _canonical_edge(shortest[i], shortest[i + 1])
            for i in range(len(shortest) - 1)
            if _canonical_edge(shortest[i], shortest[i + 1]) not in self.walls
        ]

        prev_rate = self._last_success_rate if self._last_success_rate is not None else 0.4
        simulate_revert = era_round in (6, 10) and prev_rate > 0.45

        if action in (1, 2) and path_edges:
            candidates = path_edges + open_edges
        elif self._last_visit_counts is not None and self._last_visit_counts.shape == (self.size, self.size):
            candidates = sorted(
                open_edges,
                key=lambda e: int(self._last_visit_counts[e[0]] + self._last_visit_counts[e[1]]),
                reverse=True,
            )
        else:
            order = self.rng.permutation(len(open_edges))
            candidates = [open_edges[int(i)] for i in order]

        is_move = action in (2, 3) and bool(self.walls)
        source_wall: Edge | None = None
        if is_move:
            sorted_walls = sorted(self.walls)
            if self._last_visit_counts is not None and self._last_visit_counts.shape == (self.size, self.size):
                sorted_walls.sort(
                    key=lambda e: int(self._last_visit_counts[e[0]] + self._last_visit_counts[e[1]])
                )
            source_wall = sorted_walls[0]

        for target_edge in candidates[: min(12, len(candidates))]:
            next_walls = set(self.walls)
            if is_move and source_wall is not None:
                next_walls.discard(source_wall)
            next_walls.add(target_edge)
            if _bfs_shortest_path_edges(self.size, self.start, self.goal, next_walls) is not None:
                if is_move and source_wall is not None:
                    edit: dict[str, Any] = {
                        "type": "move_wall",
                        "from": [[source_wall[0][0], source_wall[0][1]], [source_wall[1][0], source_wall[1][1]]],
                        "pos": [[target_edge[0][0], target_edge[0][1]], [target_edge[1][0], target_edge[1][1]]],
                    }
                else:
                    edit = {
                        "type": "add_wall",
                        "pos": [[target_edge[0][0], target_edge[0][1]], [target_edge[1][0], target_edge[1][1]]],
                    }
                if simulate_revert:
                    return edit, set(self.walls), True
                return edit, next_walls, False

        return None, set(self.walls), False

    def _build_q_heatmap(self, progress: float, walls: set[Edge]) -> list[list[float]]:
        """출구까지의 경계선 벽 기반 거리로 Q-Learning 최대 Q값 히트맵을 생성한다."""
        dists = _distance_to_goal_edges(self.size, self.goal, walls)
        max_dist = max(1, int(np.max(dists)))
        q_map = np.zeros((self.size, self.size), dtype=float)
        for r in range(self.size):
            for c in range(self.size):
                if dists[r, c] < 0:
                    q_map[r, c] = 0.0
                else:
                    closeness = 1.0 - (dists[r, c] / (max_dist + 1))
                    noise = float(self.rng.normal(0.0, 1.4))
                    val = (
                        config.REWARD_GOAL * (config.GAMMA ** dists[r, c]) * (0.25 + 0.75 * progress)
                        + closeness * 4.0
                        + noise
                    )
                    q_map[r, c] = round(float(val), 2)
        return q_map.tolist()

    def step(self) -> dict[str, Any]:
        """한 라운드를 실행하고 RoundResult(경계선 벽 walls 포함)를 반환한다."""
        if self.status == "finished" or self.is_finished():
            raise self._state_error_cls("Cannot step simulation when status is 'finished'")

        self.round += 1
        self._era_round += 1
        current_era = self.era
        current_size = self.size
        start_list = [self.start[0], self.start[1]]
        goal_list = [self.goal[0], self.goal[1]]
        progress = self._era_round / ROUNDS_PER_ERA

        base_shortest = _bfs_shortest_path_edges(current_size, self.start, self.goal, self.walls)
        assert base_shortest is not None
        builder_state = self._compute_builder_state(current_size, len(base_shortest) - 1)

        if self._era_round == 1:
            builder_action: int | None = None
            builder_action_name: str | None = None
            edit: dict[str, Any] | None = None
            round_walls = set(self.walls)
            edit_reverted = False
        else:
            builder_action = self._select_builder_action(builder_state)
            builder_action_name = str(BUILDER_ACTION_NAMES[builder_action])
            edit, round_walls, edit_reverted = self._apply_builder_edge_action(
                builder_action, base_shortest, self._era_round
            )

        self.walls = round_walls
        path_q = _bfs_shortest_path_edges(current_size, self.start, self.goal, round_walls)
        assert path_q is not None
        shortest_len = len(path_q) - 1

        era_difficulty = 0.055 * (current_era - 1)
        edit_shock = 0.09 if (edit is not None and not edit_reverted) else 0.0

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
                visits[r, c] = int(self.rng.integers(1, 8))
        boost = int(12 + 38 * q_success)
        for r, c in path_q:
            visits[r, c] += boost + int(self.rng.integers(0, 6))

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
            "start": start_list,
            "goal": goal_list,
            "grid": self.grid.tolist(),
            "walls": _serialize_walls(round_walls),
            "edit": edit,
            "edit_reverted": edit_reverted,
            "reports": {"q": report_q},
            "best_paths": {"q": [[int(r), int(c)] for r, c in path_q]},
            "q_values_max": {"q": self._build_q_heatmap(progress, round_walls)},
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

        if era_changed and next_size is not None:
            self.era += 1
            self._era_round = 0
            self._load_era_fixed_maze(next_size)
            self._last_success_rate = None
            self._last_shortest_len = None
            self._last_visit_counts = None

        return result
