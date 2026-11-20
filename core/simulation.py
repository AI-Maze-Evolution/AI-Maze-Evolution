"""제작 AI와 탈출 AI의 학습 라운드를 실행하고 기록한다."""

import json
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

import config
from core.environment import MazeEnv
from core.evolution import next_size, should_advance_era
from core.fixed_maze import get_fixed_grid
from core.maze import apply_edit, generate_maze, is_solvable


def _rng(name, seed):
    """모듈 이름에 해당하는 설정 시드로 NumPy 난수 생성기를 반환한다."""
    return np.random.default_rng(seed + config.SEED_OFFSET[name])


def _make_agents(builder_mode, size, seed):
    """제작 방식과 크기를 받아 Builder, Q-Learning Solver와 실행 함수를 반환한다."""
    from agents import builder
    from agents.solver import QLearningAgent, run_round

    builder_class = builder.SarsaBuilder if builder_mode == "sarsa" else builder.RuleBasedBuilder
    # Builder의 공용 상수가 합류할 때까지 인터페이스의 행동 이름을 사용한다.
    names = getattr(builder, "ACTION_NAMES", ("block_hot", "block_path", "random_wall", "remove_wall"))
    return builder_class(_rng("builder", seed)), QLearningAgent(size, _rng("q", seed)), run_round, names


def _numpy_to_json(value):
    """NumPy 배열과 스칼라를 JSON으로 기록할 수 있는 값으로 변환한다."""
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"JSON으로 변환할 수 없는 값입니다: {type(value).__name__}")


class SimulationStateError(RuntimeError):
    """현재 상태에서 허용되지 않는 제어 요청을 나타낸다."""


class Simulation:
    """미로 크기별로 제작 AI와 탈출 AI를 함께 학습시킨다."""

    def __init__(self, builder_mode="sarsa", seed=None):
        """제작 방식과 시드로 첫 시대를 초기화한다."""
        self._initialize(builder_mode, config.SEED if seed is None else seed)

    def _initial_components(self, builder_mode, seed, maze_rng):
        """제작 방식과 난수를 받아 첫 격자와 라운드 실행에 필요한 객체를 반환한다."""
        if builder_mode not in ("sarsa", "rule"):
            raise ValueError("제작 방식은 sarsa 또는 rule이어야 합니다.")
        size = config.ERA_SIZES[0]
        return generate_maze(size, maze_rng), _make_agents(builder_mode, size, seed)

    def _initialize(self, builder_mode, seed):
        """모드와 시드로 격자, 에이전트, 기록을 새로 만든다."""
        seed = int(seed)
        maze_rng = _rng("maze", seed)
        grid, (builder, solver, run_round, names) = self._initial_components(builder_mode, seed, maze_rng)
        self._builder_mode = builder_mode
        self._seed = seed
        self.round = 0
        self.era = 1
        self.size = grid.shape[0]
        self.status = "idle"
        self._history = []
        self._round_history = []
        self._last_result = None
        self._previous_report = None
        self._maze_rng = maze_rng
        self.grid = grid
        self._builder, self._q, self._run_round, self._action_names = builder, solver, run_round, names
        timestamp = datetime.now()
        log_dir = Path(config.LOG_DIR)
        while True:
            stamp = timestamp.strftime("%Y%m%d_%H%M%S")
            log_path = log_dir / f"run_{stamp}.jsonl"
            if not log_path.exists() and log_path != getattr(self, "_log_path", None):
                break
            timestamp += timedelta(seconds=1)
        self._log_path = log_path

    def _transition(self, expected, target):
        """허용 상태에서만 새 상태로 바꾸고 상태 사본을 반환한다."""
        if self.status != expected:
            raise SimulationStateError(f"{self.status} 상태에서 {target} 상태로 전환할 수 없습니다.")
        self.status = target
        return self.get_state()

    def start(self):
        """대기 중인 시뮬레이션을 실행 상태로 바꾸고 상태를 반환한다."""
        return self._transition("idle", "running")

    def pause(self):
        """실행 중인 시뮬레이션을 일시정지하고 상태를 반환한다."""
        return self._transition("running", "paused")

    def resume(self):
        """일시정지 상태에서 실행을 재개하고 상태를 반환한다."""
        return self._transition("paused", "running")

    def reset(self, builder_mode=None, seed=None):
        """지정하지 않은 모드와 시드를 유지해 초기화하고 상태를 반환한다."""
        mode = self._builder_mode if builder_mode is None else builder_mode
        self._initialize(mode, self._seed if seed is None else seed)
        return self.get_state()

    def get_state(self):
        """현재 미로, 마지막 결과, 라운드 요약을 JSON 호환 상태로 반환한다."""
        return {
            "status": self.status, "builder_mode": self._builder_mode, "seed": self._seed,
            "round": self.round, "era": self.era, "size": self.size,
            "start": [0, 0], "goal": [self.size - 1, self.size - 1], "grid": self.grid.tolist(),
            "finished": self.is_finished(), "last_result": deepcopy(self._last_result),
            "history": deepcopy(self._round_history),
        }

    def step(self):
        """현재 상태를 유지하면서 한 라운드를 진행하고 JSON 호환 결과를 반환한다."""
        return self.step_round()

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
        if self.is_finished():
            raise SimulationStateError("이미 마지막 시대가 끝났습니다.")

        edit, round_grid = None, self.grid
        if self._builder is not None:
            edit, round_grid = self._propose_edit(self._make_env(self.grid))
        env = self._make_env(round_grid)
        report = self._run_round(env, self._q, config.ROUND_EPISODES)
        reverted = edit is not None and report["success_rate"] == 0
        if not reverted:
            self.grid = round_grid
        reward, action, builder_state = 0.0, None, None
        if self._builder is not None:
            reward = self._builder.learn(self._previous_report, report, reverted)
            action = self._builder.last_action
            builder_state = self._builder.last_state
        self._previous_report = report
        self._history.append(report["success_rate"])
        self.round += 1

        following_size = None
        if self._builder is None:
            finished = self.round >= config.ERA_MAX_ROUNDS
        else:
            advance = should_advance_era(self._history, len(self._history))
            following_size = next_size(self.size) if advance else None
            finished = advance and following_size is None
        action_name = None if action is None else self._action_names[action]
        result = {
            "round": self.round, "era": self.era, "size": self.size,
            "start": env.start, "goal": env.goal,
            "grid": round_grid, "edit": edit, "edit_reverted": reverted,
            "reports": {"q": report},
            "best_paths": {"q": self._q.greedy_path(self._make_env(round_grid))},
            "q_values_max": {"q": self._q.q_table.max(axis=2)},
            "builder_mode": self._builder_mode,
            "builder_state": builder_state,
            "builder_action": action,
            "builder_action_name": action_name,
            "builder_reward": float(reward),
            "builder_q_table": self._builder.q_table if self._builder_mode == "sarsa" else None,
            "era_changed": following_size is not None, "next_size": following_size,
            "finished": finished,
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
            self._previous_report = None
            self._history.clear()
        if finished:
            self.status = "finished"
        result = json.loads(line)
        self._last_result = deepcopy(result)
        self._round_history.append({
            "round": result["round"], "era": result["era"], "size": result["size"],
            "success_rate": float(report["success_rate"]),
            "early_success_rate": float(report["early_success_rate"]),
            "avg_reward": float(report["avg_reward"]), "avg_steps": float(report["avg_steps"]),
            "builder_reward": result["builder_reward"], "builder_action_name": action_name,
            "edit_type": None if edit is None else edit["type"],
            "edit_reverted": reverted, "era_changed": result["era_changed"],
        })
        return result

    def run_all(self):
        """마지막 시대가 끝날 때까지 라운드를 기록하고 None을 반환한다."""
        while not self.is_finished():
            self.step()

    def is_finished(self):
        """마지막 시대가 끝났는지 반환한다."""
        return self.status == "finished"


class FixedMazeSimulation(Simulation):
    """같은 15×15 미로에서 Solver만 설정된 최대 라운드까지 학습시킨다."""

    def __init__(self, seed=None):
        """Solver 시드를 받아 기준 실험의 첫 상태를 초기화한다."""
        self._initialize(None, config.SEED if seed is None else seed)

    def _initial_components(self, builder_mode, seed, maze_rng):
        """시드로 고정 초기 격자와 Solver 라운드 실행에 필요한 객체를 반환한다."""
        if builder_mode is not None:
            raise ValueError("고정 미로 기준 실험은 제작 AI 없이 실행합니다.")

        from agents.solver import QLearningAgent, run_round

        grid = get_fixed_grid()
        solver = QLearningAgent(grid.shape[0], _rng("q", seed))
        return grid, (None, solver, run_round, ())
