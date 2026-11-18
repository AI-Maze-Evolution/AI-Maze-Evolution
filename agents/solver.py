"""미로 탈출용 Q-Learning 에이전트와 라운드 실행 함수."""

from collections import deque

import numpy as np

import config

try:
    from core.maze import shortest_path_len
except ModuleNotFoundError as error:
    if error.name not in {"core", "core.maze"}:
        raise
    shortest_path_len = None


_ACTIONS = ((-1, 0), (1, 0), (0, -1), (0, 1))


class QLearningAgent:
    """상태별 행동 가치를 표로 학습하는 Q-Learning 에이전트."""

    def __init__(self, size, rng):
        """미로 크기와 NumPy 난수 생성기를 받아 Q-table을 초기화한다."""
        if size <= 0:
            raise ValueError("미로 크기는 양수여야 합니다.")
        self.rng = rng
        self.name = "q"
        self.epsilon = config.EPSILON_START
        self.reset_for_size(size)

    def select_action(self, state, greedy=False):
        """좌표와 탐험 여부를 받아 ε-greedy 또는 최댓값 행동을 반환한다."""
        if not greedy and self.rng.random() < self.epsilon:
            return int(self.rng.integers(self.q_table.shape[2]))

        row, col = state
        values = self.q_table[row, col]
        best_actions = np.flatnonzero(values == np.max(values))
        return int(self.rng.choice(best_actions))

    def update(self, state, action, reward, next_state, next_action, done=None):
        """전이 정보로 최대 다음 상태 가치를 이용해 Q-table을 갱신한다."""
        if done is None:
            done = bool(next_action)
        row, col = state
        next_row, next_col = next_state
        old_value = self.q_table[row, col, action]
        next_value = 0.0 if done else float(np.max(self.q_table[next_row, next_col]))
        target = reward + config.GAMMA * next_value
        self.q_table[row, col, action] = old_value + config.ALPHA * (target - old_value)

    def decay_epsilon(self):
        """에피소드 종료 후 탐험률을 감소시키되 설정된 최솟값을 유지한다."""
        self.epsilon = max(config.EPSILON_MIN, self.epsilon * config.EPSILON_DECAY)

    def reset_for_size(self, size):
        """새 미로 크기를 받아 Q-table을 새 크기로 초기화한다."""
        if size <= 0:
            raise ValueError("미로 크기는 양수여야 합니다.")
        self.size = size
        self.q_table = np.zeros((size, size, len(_ACTIONS)), dtype=float)
        self.epsilon = config.EPSILON_START

    def greedy_path(self, env):
        """환경에서 탐험 없이 이동한 시작점 포함 경로를 반환한다."""
        state = env.reset()
        path = [state]
        for _ in range(env.max_steps):
            action = self.select_action(state, greedy=True)
            next_state, _, done, _ = env.step(action)
            path.append(next_state)
            state = next_state
            if done:
                break
        return path


class SarsaAgent(QLearningAgent):
    """실제로 선택한 다음 행동의 가치를 이용해 학습하는 SARSA 에이전트."""

    def __init__(self, size, rng):
        """미로 크기와 NumPy 난수 생성기로 SARSA 에이전트를 초기화한다."""
        super().__init__(size, rng)
        self.name = "sarsa"

    def update(self, state, action, reward, next_state, next_action, done):
        """선택한 다음 행동의 Q값을 사용해 SARSA 규칙으로 Q-table을 갱신한다."""
        row, col = state
        old_value = self.q_table[row, col, action]

        if done:
            next_value = 0.0
        else:
            if next_action is None:
                raise ValueError("종료 전 전이에는 다음 행동이 필요합니다.")
            next_row, next_col = next_state
            next_value = float(self.q_table[next_row, next_col, next_action])

        target = reward + config.GAMMA * next_value
        self.q_table[row, col, action] = old_value + config.ALPHA * (target - old_value)


def _shortest_path_length(env):
    """환경에서 공개된 최단 경로 함수를 사용해 최단 걸음 수를 반환한다."""
    if shortest_path_len is not None:
        return shortest_path_len(env.grid, env.start, env.goal)

    # core/maze.py가 아직 병합되지 않은 작업 브랜치에서의 임시 BFS이다.
    pending = deque([(env.start, 0)])
    visited = {env.start}
    while pending:
        (row, col), distance = pending.popleft()
        if (row, col) == env.goal:
            return distance
        for row_delta, col_delta in _ACTIONS:
            neighbor = (row + row_delta, col + col_delta)
            next_row, next_col = neighbor
            if (
                0 <= next_row < env.size
                and 0 <= next_col < env.size
                and neighbor not in visited
                and env.grid[next_row, next_col] == 0
            ):
                visited.add(neighbor)
                pending.append((neighbor, distance + 1))
    return None


def run_round(env, agent, n_episodes):
    """환경·에이전트·학습 판 수를 받아 인터페이스 형식의 성적표를 반환한다."""
    if n_episodes < 0:
        raise ValueError("에피소드 수는 음수일 수 없습니다.")

    visit_counts = np.zeros((env.size, env.size), dtype=int)
    successes = 0
    early_successes = 0
    total_steps = 0
    total_reward = 0.0

    for episode in range(n_episodes):
        state = env.reset()
        visit_counts[state] += 1
        episode_reward = 0.0
        episode_steps = 0
        done = False
        success = False
        action = agent.select_action(state)

        while not done:
            next_state, reward, done, info = env.step(action)
            next_action = None
            if isinstance(agent, SarsaAgent) and not done:
                next_action = agent.select_action(next_state)
            agent.update(state, action, reward, next_state, next_action, done)

            visit_counts[next_state] += 1
            episode_reward += reward
            episode_steps = info.get("steps", episode_steps + 1)
            success = success or info.get("result") == "goal"
            state = next_state
            if not done:
                action = (
                    next_action
                    if isinstance(agent, SarsaAgent)
                    else agent.select_action(state)
                )

        successes += int(success)
        if episode < config.ROUND_EARLY_EPISODES:
            early_successes += int(success)
        total_steps += episode_steps
        total_reward += episode_reward
        agent.decay_epsilon()

    early_episode_count = min(n_episodes, config.ROUND_EARLY_EPISODES)
    return {
        "algo": agent.name,
        "n_episodes": n_episodes,
        "success_rate": successes / n_episodes if n_episodes else 0.0,
        "early_success_rate": (
            early_successes / early_episode_count if early_episode_count else 0.0
        ),
        "trap_rate": 0.0,
        "avg_steps": total_steps / n_episodes if n_episodes else 0.0,
        "avg_reward": total_reward / n_episodes if n_episodes else 0.0,
        "visit_counts": visit_counts,
        "shortest_path_len": _shortest_path_length(env),
    }
