"""미로 제작 AI (Builder).

RuleBasedBuilder, SarsaBuilder 두 종류가 있으며 공개 인터페이스는 docs/interface.md 9번을 따른다.

- propose_edit(grid, start, goal, report) -> edit 또는 None
- learn(prev_report, next_report, edit_reverted) -> float (보상)
- 속성: last_state, last_action (로그용)

상태는 미로 크기와 무관하게 (성공률 구간, 최단 경로 구간)으로 정하므로
시대가 바뀌어도 Q-table을 그대로 유지할 수 있다.
"""

import numpy as np

import config

try:  # core/maze.py가 아직 없을 수 있으므로 같은 값으로 대체 정의한다.
    from core.maze import EMPTY, WALL
except ImportError:
    EMPTY = 0
    WALL = 1

# 행동 번호
ACTION_WALL_MOST_VISITED = 0  # 방문이 많은 빈칸에 벽
ACTION_WALL_ON_PATH = 1  # 최단 경로 위의 칸에 벽
ACTION_WALL_RANDOM = 2  # 무작위 빈칸에 벽
ACTION_REMOVE_WALL = 3  # 무작위 벽 하나 제거
N_ACTIONS = 4

# 상태 구간 개수 (성공률 3구간 × 최단 경로 3구간)
N_SUCCESS_BINS = 3
N_PATH_BINS = 3

# 최단 경로 구간 경계: 최단 경로 걸음 ÷ (2n-2)
PATH_RATIO_SHORT = 1.2  # 이하이면 구간 0 (짧음)
PATH_RATIO_MEDIUM = 1.6  # 이하이면 구간 1 (보통), 초과면 구간 2 (김)

# 보상 설계 (agents/AGENTS.md 초기 설계안)
REWARD_IN_TARGET = 1.0  # 성공률이 목표 구간 안
REWARD_TOO_EASY = 0.0  # 성공률이 상한 초과 (너무 쉬움)
REWARD_TOO_HARD = -0.5  # 성공률이 하한 미만 (너무 어려움)
REWARD_REVERTED = -1.0  # 성공률 0이라 수정이 취소됨
REWARD_PATH_LONGER = 0.2  # 최단 경로가 길어졌을 때 가산


def success_bin(success_rate):
    """성공률을 구간 번호로 바꾼다.

    입력: success_rate (float, 0~1)
    출력: 0 (BUILDER_TARGET_LOW 미만), 1 (LOW 이상 HIGH 이하), 2 (HIGH 초과)
    """
    if success_rate < config.BUILDER_TARGET_LOW:
        return 0
    if success_rate <= config.BUILDER_TARGET_HIGH:
        return 1
    return 2


def path_bin(path_len, size):
    """최단 경로 길이를 구간 번호로 바꾼다.

    입력: path_len (int 또는 None, 최단 경로 걸음 수), size (int, 미로 한 변 길이)
    출력: 0 (비율 1.2 이하), 1 (1.6 이하), 2 (초과 또는 경로 없음)
    """
    if path_len is None:
        return 2
    ratio = path_len / (2 * size - 2)
    if ratio <= PATH_RATIO_SHORT:
        return 0
    if ratio <= PATH_RATIO_MEDIUM:
        return 1
    return 2


def _report_size(report):
    """성적표의 visit_counts에서 미로 한 변 길이를 구한다."""
    return int(np.asarray(report["visit_counts"]).shape[0])


def state_from_report(report):
    """성적표로 Builder 상태를 계산한다.

    입력: report (dict, interface.md 8번 형식의 성적표)
    출력: (성공률 구간, 최단 경로 구간) 튜플
    """
    return (
        success_bin(report["success_rate"]),
        path_bin(report["shortest_path_len"], _report_size(report)),
    )


class BaseBuilder:
    """RuleBasedBuilder와 SarsaBuilder가 공유하는 기반 클래스.

    두 Builder의 차이는 행동 선택 순서(_action_order)와 learn의 학습 여부뿐이다.
    """

    def __init__(self, rng, path_fn=None):
        """Builder를 만든다.

        입력:
            rng: np.random.Generator (np.random.default_rng(config.SEED + 오프셋))
            path_fn: shortest_path(grid, start, goal) 함수.
                None이면 사용할 때 core.maze.shortest_path를 지연 import한다.
        """
        self.rng = rng
        self._path_fn = path_fn
        self.last_state = None  # 마지막 상태 (성공률 구간, 최단 경로 구간)
        self.last_action = None  # 마지막 행동 번호

    # ------------------------------------------------------------------
    # 공개 인터페이스
    # ------------------------------------------------------------------
    def propose_edit(self, grid, start, goal, report):
        """미로 수정안을 낸다.

        입력:
            grid: n×n 2차원 int 배열 (EMPTY=0, WALL=1)
            start, goal: (행, 열) 튜플
            report: 직전 라운드의 성적표 (첫 라운드는 None)
        출력:
            {"type": "add_wall" | "remove_wall", "pos": (행, 열)} 또는 None.
            첫 라운드이거나 수정할 곳이 없으면 None.
            시작점·출구는 절대 대상으로 고르지 않으며,
            벽 추가는 출구까지 길이 남는 경우에만 제안한다.
        """
        if report is None:
            self.last_state = None
            self.last_action = None
            return None

        grid = np.asarray(grid)
        start = tuple(start)
        goal = tuple(goal)
        state = state_from_report(report)
        self.last_state = state
        self.last_action = None

        for action in self._action_order(state):
            edit = self._make_edit(action, grid, start, goal, report)
            if edit is not None:
                self.last_action = int(action)
                return edit
        return None

    def learn(self, prev_report, next_report, edit_reverted):
        """직전 수정의 결과로 보상을 계산하고 학습한다.

        입력:
            prev_report: 수정 전(직전 라운드) 성적표 또는 None
            next_report: 수정 후 이번 라운드 성적표
            edit_reverted: 성공률 0이라 수정이 취소되었으면 True
        출력: 보상 (float)
        """
        reward = self.compute_reward(prev_report, next_report, edit_reverted)
        self._update(reward, next_report)
        return reward

    def compute_reward(self, prev_report, next_report, edit_reverted):
        """보상을 계산한다 (학습 없음).

        입력: learn과 같다.
        출력: 되돌림이면 -1, 아니면 성공률이 목표 구간 안 +1 / 상한 초과 0 / 하한 미만 -0.5.
            이전 성적표가 있고 최단 경로가 길어졌으면 +0.2를 더한다.
            (시대가 바뀌어 미로 크기가 다르면 경로 길이를 비교하지 않는다.)
        """
        if edit_reverted:
            return REWARD_REVERTED

        rate = next_report["success_rate"]
        bin_ = success_bin(rate)
        if bin_ == 1:
            reward = REWARD_IN_TARGET
        elif bin_ == 2:
            reward = REWARD_TOO_EASY
        else:
            reward = REWARD_TOO_HARD

        if prev_report is not None and _report_size(prev_report) == _report_size(next_report):
            prev_len = prev_report["shortest_path_len"]
            next_len = next_report["shortest_path_len"]
            if prev_len is not None and next_len is not None and next_len > prev_len:
                reward += REWARD_PATH_LONGER
        return reward

    # ------------------------------------------------------------------
    # 하위 클래스가 정하는 부분
    # ------------------------------------------------------------------
    def _action_order(self, state):
        """상태에서 시도할 행동 번호를 우선순위대로 돌려준다 (하위 클래스에서 구현)."""
        raise NotImplementedError

    def _update(self, reward, next_report):
        """보상으로 학습한다. 기본은 학습 없음 (RuleBasedBuilder)."""

    # ------------------------------------------------------------------
    # 내부 도구
    # ------------------------------------------------------------------
    def _get_path_fn(self):
        """최단 경로 함수를 돌려준다. 주입된 것이 없으면 core.maze.shortest_path를 지연 import한다."""
        if self._path_fn is None:
            from core.maze import shortest_path

            self._path_fn = shortest_path
        return self._path_fn

    def _make_edit(self, action, grid, start, goal, report):
        """행동 번호에 해당하는 edit를 만든다. 만들 수 없으면 None.

        입력: action (int), grid, start, goal, report
        출력: edit dict 또는 None
        """
        if action == ACTION_REMOVE_WALL:
            return self._remove_wall_edit(grid, start, goal)

        if action == ACTION_WALL_MOST_VISITED:
            cells = self._empty_cells(grid, start, goal)
            cells = self._sort_by_visits(cells, report)
        elif action == ACTION_WALL_ON_PATH:
            path = self._get_path_fn()(grid, start, goal)
            if path is None:
                return None
            cells = [tuple(p) for p in path if tuple(p) not in (start, goal)]
            cells = [p for p in cells if grid[p] == EMPTY]
            cells = self._sort_by_visits(cells, report)
        elif action == ACTION_WALL_RANDOM:
            cells = self._empty_cells(grid, start, goal)
            cells = [cells[i] for i in self.rng.permutation(len(cells))]
        else:
            return None

        for pos in cells:
            if self._keeps_path(grid, pos, start, goal):
                return {"type": "add_wall", "pos": pos}
        return None

    def _empty_cells(self, grid, start, goal):
        """시작점·출구를 뺀 EMPTY 칸 목록 [(행, 열), ...]을 돌려준다."""
        rows, cols = np.where(grid == EMPTY)
        return [
            (int(r), int(c))
            for r, c in zip(rows, cols)
            if (int(r), int(c)) not in (start, goal)
        ]

    def _remove_wall_edit(self, grid, start, goal):
        """무작위 WALL 칸 하나를 제거하는 edit를 돌려준다. 벽이 없으면 None."""
        rows, cols = np.where(grid == WALL)
        cells = [
            (int(r), int(c))
            for r, c in zip(rows, cols)
            if (int(r), int(c)) not in (start, goal)
        ]
        if not cells:
            return None
        pos = cells[int(self.rng.integers(len(cells)))]
        return {"type": "remove_wall", "pos": pos}

    def _sort_by_visits(self, cells, report):
        """칸을 visit_counts가 큰 순서로 정렬한다. 같은 값은 무작위 순서로 섞는다."""
        if not cells:
            return []
        visits = np.asarray(report["visit_counts"])
        order = self.rng.permutation(len(cells))
        shuffled = [cells[i] for i in order]
        return sorted(shuffled, key=lambda p: -int(visits[p]))

    def _keeps_path(self, grid, pos, start, goal):
        """pos에 벽을 놓아도 출구까지 길이 남는지 복사본으로 미리 확인한다."""
        trial = grid.copy()
        trial[pos] = WALL
        return self._get_path_fn()(trial, start, goal) is not None


class RuleBasedBuilder(BaseBuilder):
    """고정 규칙으로 행동을 고르는 Builder. 학습하지 않고 보상만 계산한다."""

    def _action_order(self, state):
        """성공률 구간별 고정 행동 하나를 돌려준다.

        입력: state (성공률 구간, 최단 경로 구간)
        출력: 행동 번호 리스트 (원소 1개)
            성공률 구간 2: 최단 경로 구간 0이면 행동 1, 아니면 행동 0
            성공률 구간 1: 행동 2
            성공률 구간 0: 행동 3
        """
        s_bin, p_bin = state
        if s_bin == 2:
            return [ACTION_WALL_ON_PATH if p_bin == 0 else ACTION_WALL_MOST_VISITED]
        if s_bin == 1:
            return [ACTION_WALL_RANDOM]
        return [ACTION_REMOVE_WALL]


class SarsaBuilder(BaseBuilder):
    """SARSA로 행동을 고르는 Builder.

    q_table shape은 (성공률 구간 3, 최단 경로 구간 3, 행동 4)이고 0으로 시작한다.
    상태가 미로 크기와 무관하므로 시대가 바뀌어도 q_table을 유지한다.

    SARSA 흐름:
        learn에서 다음 상태 s'와 다음 행동 a'를 먼저 정하고, Q[s',a']로 Q[s,a]를 갱신한다.
        a'는 pending_action에 저장되고, 다음 propose_edit가 그 행동을 실행한다.
        첫 수정에서는 pending_action이 없으므로 현재 상태에서 ε-greedy로 고른다.
    """

    def __init__(self, rng, path_fn=None):
        """입력은 BaseBuilder와 같다. q_table을 0으로 초기화하고 pending을 비운다."""
        super().__init__(rng, path_fn)
        self.q_table = np.zeros((N_SUCCESS_BINS, N_PATH_BINS, N_ACTIONS))
        self.pending_state = None  # learn이 정한 다음 상태 s'
        self.pending_action = None  # learn이 정한 다음 행동 a' (다음 propose_edit가 실행)

    def _greedy_order(self, state):
        """상태에서 Q값이 큰 순서의 행동 번호 4개를 돌려준다. 같은 값은 무작위 순서."""
        q_values = self.q_table[state]
        shuffled = [int(a) for a in self.rng.permutation(N_ACTIONS)]
        return sorted(shuffled, key=lambda a: -q_values[a])

    def _epsilon_greedy_order(self, state):
        """ε-greedy로 첫 행동을 고르고, 나머지는 Q값이 큰 순서로 잇는다.

        입력: state (성공률 구간, 최단 경로 구간)
        출력: 행동 번호 리스트 (4개 모두)
        """
        greedy_order = self._greedy_order(state)
        if self.rng.random() < config.BUILDER_EPSILON:
            first = int(self.rng.integers(N_ACTIONS))
            return [first] + [a for a in greedy_order if a != first]
        return greedy_order

    def _action_order(self, state):
        """이번 수정에서 시도할 행동 순서를 돌려준다.

        입력: state (성공률 구간, 최단 경로 구간)
        출력: 행동 번호 리스트 (4개 모두).
            pending_action이 있으면 그 행동이 먼저이고, 나머지는 Q값 순서다.
            없으면(첫 수정) ε-greedy 순서다.
            앞선 행동이 edit를 못 내면 propose_edit가 다음 행동을 시도한다.
        """
        if self.pending_action is not None:
            first = self.pending_action
            return [first] + [a for a in self._greedy_order(state) if a != first]
        return self._epsilon_greedy_order(state)

    def _update(self, reward, next_report):
        """SARSA 업데이트를 하고 다음 행동을 정해 둔다.

        순서: 다음 상태 s' 계산 → s'에서 ε-greedy로 a' 선택 →
            Q[s,a] += α × (보상 + γ × Q[s',a'] − Q[s,a]) → s', a'를 pending에 저장.

        입력: reward (float), next_report (s'를 계산할 이번 라운드 성적표)
        출력: 없음. 직전에 수정을 내지 못했으면 (last_action이 None) Q는 갱신하지 않고
            다음 행동만 정해 둔다.
        """
        next_state = state_from_report(next_report)
        next_action = self._epsilon_greedy_order(next_state)[0]

        if self.last_state is not None and self.last_action is not None:
            s, a = self.last_state, self.last_action
            target = reward + config.BUILDER_GAMMA * self.q_table[next_state][next_action]
            self.q_table[s][a] += config.BUILDER_ALPHA * (target - self.q_table[s][a])

        self.pending_state = next_state
        self.pending_action = next_action
