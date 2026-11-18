"""agents/builder.py 테스트. core.maze에 의존하지 않고 가짜 path_fn(BFS)을 주입한다."""

from collections import deque

import numpy as np
import pytest

import config
from agents.builder import QBuilder, RuleBasedBuilder

EMPTY, WALL = 0, 1
EDIT_TYPES = {"add_wall", "remove_wall"}


def fake_path(grid, start, goal):
    """테스트용 BFS 최단 경로. 길이 없으면 None."""
    n = grid.shape[0]
    prev = {start: None}
    queue = deque([start])
    while queue:
        cur = queue.popleft()
        if cur == goal:
            path = []
            while cur is not None:
                path.append(cur)
                cur = prev[cur]
            return path[::-1]
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nxt = (cur[0] + dr, cur[1] + dc)
            if 0 <= nxt[0] < n and 0 <= nxt[1] < n and grid[nxt] == EMPTY and nxt not in prev:
                prev[nxt] = cur
                queue.append(nxt)
    return None


def make_report(rate, path_len=8, n=5, visits=None):
    """통합 성적표 흉내. 필요한 키만 채운다."""
    if visits is None:
        visits = np.arange(n * n).reshape(n, n)
    return {
        "algo": "merged",
        "success_rate": rate,
        "shortest_path_len": path_len,
        "visit_counts": visits,
    }


def make_grid(n=5, walls=((1, 1), (2, 3), (3, 1))):
    grid = np.zeros((n, n), dtype=int)
    for pos in walls:
        grid[pos] = WALL
    return grid


def make_builders(seed):
    rng_a = np.random.default_rng(config.SEED + config.SEED_OFFSET["builder"] + seed)
    rng_b = np.random.default_rng(config.SEED + config.SEED_OFFSET["builder"] + seed)
    return [RuleBasedBuilder(rng_a, path_fn=fake_path), QBuilder(rng_b, path_fn=fake_path)]


# 성공률 구간 0/1/2 × 최단 경로 구간 0/1/2 를 모두 만드는 성적표들
ALL_REPORTS = [make_report(r, p) for r in (0.1, 0.5, 0.9) for p in (8, 11, 15)]


def check_edit_format(edit, grid, n):
    assert isinstance(edit, dict)
    assert set(edit.keys()) == {"type", "pos"}
    assert edit["type"] in EDIT_TYPES
    assert isinstance(edit["pos"], tuple) and len(edit["pos"]) == 2
    r, c = edit["pos"]
    assert 0 <= r < n and 0 <= c < n
    if edit["type"] == "add_wall":
        assert grid[r, c] == EMPTY
    else:
        assert grid[r, c] == WALL


def test_propose_edit_returns_valid_format():
    grid = make_grid()
    start, goal = (0, 0), (4, 4)
    for seed in range(20):
        for builder in make_builders(seed):
            for report in ALL_REPORTS:
                edit = builder.propose_edit(grid, start, goal, report)
                if edit is not None:
                    check_edit_format(edit, grid, 5)


def test_first_round_returns_none():
    for builder in make_builders(0):
        assert builder.propose_edit(make_grid(), (0, 0), (4, 4), None) is None
        assert builder.last_state is None
        assert builder.last_action is None


def test_never_targets_start_or_goal():
    start, goal = (0, 0), (4, 4)
    grids = [make_grid(), np.zeros((5, 5), dtype=int), np.ones((5, 5), dtype=int)]
    grids[2][start] = EMPTY
    grids[2][goal] = EMPTY
    for seed in range(50):
        for builder in make_builders(seed):
            for grid in grids:
                for report in ALL_REPORTS:
                    edit = builder.propose_edit(grid, start, goal, report)
                    if edit is not None:
                        assert edit["pos"] not in (start, goal)


def test_no_trap_edit_when_traps_disabled(monkeypatch):
    monkeypatch.setattr(config, "ENABLE_TRAPS", False)
    grid = make_grid()
    for seed in range(30):
        for builder in make_builders(seed):
            for report in ALL_REPORTS:
                edit = builder.propose_edit(grid, (0, 0), (4, 4), report)
                if edit is not None:
                    assert edit["type"] in EDIT_TYPES


def test_never_proposes_wall_that_blocks_path():
    # 3x3 외길: (0,0)-(0,1)-(0,2)-(1,2)-(2,2). 시작·출구를 뺀 빈칸은 모두 길 위라 벽을 놓으면 막힌다.
    grid = np.array([[0, 0, 0], [1, 1, 0], [1, 1, 0]])
    start, goal = (0, 0), (2, 2)
    assert fake_path(grid, start, goal) is not None
    for seed in range(50):
        for builder in make_builders(seed):
            for report in [make_report(r, 4, n=3) for r in (0.1, 0.5, 0.9)]:
                edit = builder.propose_edit(grid, start, goal, report)
                if edit is None:
                    continue
                assert edit["type"] == "remove_wall"  # 벽 추가는 길을 막으므로 나올 수 없다
                after = grid.copy()
                after[edit["pos"]] = EMPTY
                assert fake_path(after, start, goal) is not None


def test_rule_builder_actions_by_success_bin():
    grid = make_grid()
    start, goal = (0, 0), (4, 4)

    # 성공률 구간 0 (너무 어려움): 벽 제거
    b = RuleBasedBuilder(np.random.default_rng(1), path_fn=fake_path)
    edit = b.propose_edit(grid, start, goal, make_report(0.1))
    assert edit["type"] == "remove_wall" and b.last_action == 3 and b.last_state[0] == 0

    # 성공률 구간 1 (적당): 무작위 빈칸에 벽
    b = RuleBasedBuilder(np.random.default_rng(1), path_fn=fake_path)
    edit = b.propose_edit(grid, start, goal, make_report(0.5))
    assert edit["type"] == "add_wall" and b.last_action == 2 and b.last_state[0] == 1

    # 성공률 구간 2 + 최단 경로 구간 0 (8 / 8 = 1.0): 최단 경로 위의 칸에 벽
    b = RuleBasedBuilder(np.random.default_rng(1), path_fn=fake_path)
    edit = b.propose_edit(grid, start, goal, make_report(0.9, path_len=8))
    path = fake_path(grid, start, goal)
    assert edit["type"] == "add_wall" and b.last_action == 1
    assert b.last_state == (2, 0)
    assert edit["pos"] in path[1:-1]

    # 성공률 구간 2 + 최단 경로 구간 2: 가장 많이 방문된 빈칸에 벽
    visits = np.zeros((5, 5), dtype=int)
    visits[2, 2] = 999
    b = RuleBasedBuilder(np.random.default_rng(1), path_fn=fake_path)
    edit = b.propose_edit(grid, start, goal, make_report(0.9, path_len=15, visits=visits))
    assert edit == {"type": "add_wall", "pos": (2, 2)} and b.last_action == 0
    assert b.last_state == (2, 2)


@pytest.mark.parametrize(
    "rate, expected",
    [(0.0, -0.5), (0.1, -0.5), (0.29, -0.5), (0.3, 1.0), (0.5, 1.0), (0.7, 1.0), (0.71, 0.0), (1.0, 0.0)],
)
def test_learn_reward_by_success_bin(rate, expected):
    for builder in make_builders(0):
        reward = builder.learn(make_report(0.5), make_report(rate), edit_reverted=False)
        assert reward == pytest.approx(expected)


def test_learn_reward_when_reverted():
    for builder in make_builders(0):
        reward = builder.learn(make_report(0.5), make_report(0.0), edit_reverted=True)
        assert reward == pytest.approx(-1.0)


def test_learn_reward_path_longer_bonus():
    for builder in make_builders(0):
        longer = builder.learn(make_report(0.5, path_len=8), make_report(0.5, path_len=10), False)
        same = builder.learn(make_report(0.5, path_len=8), make_report(0.5, path_len=8), False)
        first = builder.learn(None, make_report(0.5, path_len=10), False)
        assert longer == pytest.approx(1.2)
        assert same == pytest.approx(1.0)
        assert first == pytest.approx(1.0)


def test_q_builder_learn_changes_q_table():
    builder = QBuilder(np.random.default_rng(3), path_fn=fake_path)
    assert builder.q_table.shape == (3, 3, 4)
    assert not builder.q_table.any()

    edit = builder.propose_edit(make_grid(), (0, 0), (4, 4), make_report(0.5))
    assert edit is not None and builder.last_action is not None
    before = builder.q_table.copy()
    reward = builder.learn(make_report(0.5), make_report(0.5), edit_reverted=False)

    assert reward == pytest.approx(1.0)
    assert not np.array_equal(before, builder.q_table)
    s, a = builder.last_state, builder.last_action
    assert builder.q_table[s][a] == pytest.approx(config.BUILDER_ALPHA * 1.0)


def test_rule_builder_does_not_learn():
    builder = RuleBasedBuilder(np.random.default_rng(3), path_fn=fake_path)
    assert not hasattr(builder, "q_table")
    builder.propose_edit(make_grid(), (0, 0), (4, 4), make_report(0.5))
    assert builder.learn(make_report(0.5), make_report(0.5), False) == pytest.approx(1.0)


def test_q_builder_falls_back_to_other_actions():
    # 벽이 하나도 없는 미로에서는 행동 3(벽 제거)이 None이지만 다른 행동으로 edit를 낸다.
    grid = np.zeros((5, 5), dtype=int)
    for seed in range(30):
        builder = QBuilder(np.random.default_rng(seed), path_fn=fake_path)
        # 행동 3의 Q값을 가장 크게 만들어 먼저 시도되게 한다.
        builder.q_table[:, :, 3] = 10.0
        edit = builder.propose_edit(grid, (0, 0), (4, 4), make_report(0.5))
        assert edit is not None
        assert edit["type"] == "add_wall"
        assert builder.last_action in (0, 1, 2)
