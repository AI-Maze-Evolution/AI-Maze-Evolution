"""제작 AI와 두 탈출 AI의 학습 라운드를 실행하고 기록한다."""

import json
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import numpy as np

from core.environment import MazeEnv
from core.evolution import next_size, should_advance_era
from core.maze import apply_edit, generate_maze, is_solvable

try:
    import config
except ModuleNotFoundError as error:
    if error.name != "config":
        raise
    config = SimpleNamespace(
        SEED=42, SEED_OFFSET={"maze": 0, "q": 1, "sarsa": 2, "builder": 3},
        ERA_SIZES=(5, 7, 10), MAX_STEPS_FACTOR=4, ROUND_EPISODES=50,
        MAX_EDIT_RETRY=3, LOG_DIR="logs",
    )


def _rng(name):
    """모듈 이름에 해당하는 설정 시드로 NumPy 난수 생성기를 반환한다."""
    return np.random.default_rng(config.SEED + config.SEED_OFFSET[name])


def _make_agents(builder_mode, size):
    """제작 방식과 크기를 받아 Builder, 두 Solver, 라운드 함수를 반환한다."""
    from agents.builder import QBuilder, RuleBasedBuilder
    from agents.solver import QLearningAgent, SarsaAgent, run_round

    builder_class = QBuilder if builder_mode == "q" else RuleBasedBuilder
    return (
        builder_class(_rng("builder")), QLearningAgent(size, _rng("q")),
        SarsaAgent(size, _rng("sarsa")), run_round,
    )


def merge_reports(q_report, sarsa_report):
    """두 Solver 성적표를 받아 성공률과 평균을 평균 내고 방문 수를 합산한다."""
    keys = ("success_rate", "early_success_rate", "trap_rate", "avg_steps", "avg_reward")
    merged = {key: (q_report[key] + sarsa_report[key]) / 2 for key in keys}
    merged.update(
        algo="merged",
        n_episodes=q_report["n_episodes"] + sarsa_report["n_episodes"],
        visit_counts=q_report["visit_counts"] + sarsa_report["visit_counts"],
        shortest_path_len=q_report["shortest_path_len"],
    )
    return merged


def _numpy_to_json(value):
    """NumPy 배열과 스칼라를 JSON으로 기록할 수 있는 값으로 변환한다."""
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"JSON으로 변환할 수 없는 값입니다: {type(value).__name__}")


class Simulation:
    """미로 크기별로 제작 AI와 두 탈출 AI를 함께 학습시킨다."""

    def __init__(self, builder_mode="q"):
        """제작 방식으로 에이전트, 첫 미로와 로그 경로를 초기화한다."""
        if builder_mode not in ("q", "rule"):
            raise ValueError("제작 방식은 q 또는 rule이어야 합니다.")
        self.round = 0
        self.era = 1
        self.size = config.ERA_SIZES[0]
        self._history = []
        self._previous_report = None
        self._finished = False
        self._maze_rng = _rng("maze")
        self.grid = generate_maze(self.size, self._maze_rng)
        self._builder, self._q, self._sarsa, self._run_round = _make_agents(builder_mode, self.size)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._log_path = Path(config.LOG_DIR) / f"run_{stamp}.jsonl"

    def _make_env(self, grid):
        """라운드 격자를 받아 출발점과 최대 걸음 수가 설정된 환경을 반환한다."""
        goal = (self.size - 1, self.size - 1)
        return MazeEnv(grid, (0, 0), goal, config.MAX_STEPS_FACTOR * self.size**2)

    def _propose_edit(self, env):
        """현재 환경을 받아 적용 가능한 수정안과 격자 또는 기존 격자를 반환한다."""
        for _ in range(config.MAX_EDIT_RETRY):
            edit = self._builder.propose_edit(env.grid, env.start, env.goal, self._previous_report)
            if edit is None:
                break
            try:
                grid = apply_edit(env.grid, edit)
            except ValueError:
                continue
            if is_solvable(grid, env.start, env.goal):
                return edit, grid
        return None, env.grid

    def step_round(self):
        """한 라운드를 진행하고 로그와 같은 내용의 결과 사전을 반환한다."""
        if self._finished:
            raise RuntimeError("이미 마지막 시대가 끝났습니다.")

        edit, round_grid = self._propose_edit(self._make_env(self.grid))
        env_q = self._make_env(round_grid)
        env_sarsa = self._make_env(round_grid)
        q_report = self._run_round(env_q, self._q, config.ROUND_EPISODES)
        sarsa_report = self._run_round(env_sarsa, self._sarsa, config.ROUND_EPISODES)
        merged = merge_reports(q_report, sarsa_report)
        reverted = edit is not None and merged["success_rate"] == 0
        if not reverted:
            self.grid = round_grid
        reward = self._builder.learn(self._previous_report, merged, reverted)
        self._previous_report = merged
        self._history.append(merged["success_rate"])
        self.round += 1

        advance = should_advance_era(self._history, len(self._history))
        following_size = next_size(self.size) if advance else None
        self._finished = advance and following_size is None
        result = {
            "round": self.round, "era": self.era, "size": self.size,
            "grid": round_grid, "edit": edit, "edit_reverted": reverted,
            "reports": {"q": q_report, "sarsa": sarsa_report, "merged": merged},
            "best_paths": {
                "q": self._q.greedy_path(self._make_env(round_grid)),
                "sarsa": self._sarsa.greedy_path(self._make_env(round_grid)),
            },
            "q_values_max": {
                "q": self._q.q_table.max(axis=2), "sarsa": self._sarsa.q_table.max(axis=2),
            },
            "builder_state": self._builder.last_state,
            "builder_action": self._builder.last_action,
            "builder_reward": reward,
            "era_changed": following_size is not None, "finished": self._finished,
        }
        line = json.dumps(result, default=_numpy_to_json, ensure_ascii=False)
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        with self._log_path.open("a", encoding="utf-8") as log:
            log.write(line + "\n")

        if following_size is not None:
            self.era += 1
            self.size = following_size
            self.grid = generate_maze(self.size, self._maze_rng)
            self._q.reset_for_size(self.size)
            self._sarsa.reset_for_size(self.size)
            self._previous_report = None
            self._history.clear()
        return json.loads(line)

    def run_all(self):
        """마지막 시대가 끝날 때까지 라운드를 기록하고 None을 반환한다."""
        while not self.is_finished():
            self.step_round()

    def is_finished(self):
        """마지막 시대가 끝났는지 반환한다."""
        return self._finished
