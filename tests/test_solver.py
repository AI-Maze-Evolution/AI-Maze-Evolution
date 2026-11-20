"""Q-Learning 에이전트와 라운드 성적표 검증."""

import numpy as np

import config
from agents.solver import QLearningAgent, run_round


class OpenMazeEnv:
    """벽이 없는 격자에서 Solver 동작을 검증하는 간단한 환경."""

    def __init__(self, size=5):
        """미로 크기로 빈 격자와 기본 환경 속성을 초기화한다."""
        self.size = size
        self.grid = np.zeros((size, size), dtype=int)
        self.start = (0, 0)
        self.goal = (size - 1, size - 1)
        self.max_steps = config.MAX_STEPS_FACTOR * size * size
        self.reset()

    def reset(self):
        """에피소드를 시작 좌표에서 다시 시작하고 그 좌표를 반환한다."""
        self.state = self.start
        self.steps = 0
        return self.state

    def step(self, action):
        """행동을 적용하고 다음 좌표, 보상, 종료 여부와 정보를 반환한다."""
        row, col = self.state
        row_delta, col_delta = ((-1, 0), (1, 0), (0, -1), (0, 1))[action]
        next_state = (row + row_delta, col + col_delta)
        self.steps += 1
        if not (0 <= next_state[0] < self.size and 0 <= next_state[1] < self.size):
            next_state = self.state
            reward = config.REWARD_WALL_BUMP
            hit_wall = True
        else:
            self.state = next_state
            reward = config.REWARD_GOAL if next_state == self.goal else config.REWARD_STEP
            hit_wall = False

        success = self.state == self.goal
        timeout = self.steps >= self.max_steps and not success
        if timeout:
            reward += config.REWARD_TIMEOUT
        result = "goal" if success else "timeout" if timeout else None
        return self.state, reward, success or timeout, {
            "result": result, "hit_wall": hit_wall, "steps": self.steps,
        }


def _make_agent():
    """프로젝트 시드 규칙으로 5×5 Q-Learning 에이전트를 반환한다."""
    rng = np.random.default_rng(config.SEED + config.SEED_OFFSET["q"])
    return QLearningAgent(5, rng)


def test_q_table_updates_and_resets_for_new_size():
    """전이 학습으로 Q값이 바뀌고 크기 변경 시 표가 다시 초기화되는지 확인한다."""
    agent = _make_agent()
    agent.update((0, 0), 3, config.REWARD_STEP, (0, 1), False)
    assert agent.q_table[0, 0, 3] != 0

    agent.reset_for_size(7)
    assert agent.q_table.shape == (7, 7, 4)
    assert np.count_nonzero(agent.q_table) == 0
    assert agent.epsilon == config.EPSILON_START


def test_learning_reaches_goal_in_open_maze():
    """벽 없는 5×5에서 500판 학습 후 높은 성공률과 출구 도달을 확인한다."""
    env = OpenMazeEnv()
    agent = _make_agent()
    report = run_round(env, agent, 500)

    assert report["success_rate"] >= 0.9
    assert agent.greedy_path(env)[-1] == env.goal


def test_report_has_interface_fields_and_expected_shapes():
    """성적표 키, 배열 크기, 초기 성공률과 예약 함정률을 확인한다."""
    env = OpenMazeEnv()
    report = run_round(env, _make_agent(), 3)

    assert set(report) == {
        "algo", "n_episodes", "success_rate", "early_success_rate", "trap_rate",
        "avg_steps", "avg_reward", "visit_counts", "shortest_path_len",
    }
    assert report["algo"] == "q"
    assert report["n_episodes"] == 3
    assert report["visit_counts"].shape == (5, 5)
    assert report["visit_counts"].dtype == int
    assert report["early_success_rate"] == report["success_rate"]
    assert report["trap_rate"] == 0.0
    assert report["shortest_path_len"] == 2 * (env.size - 1)
