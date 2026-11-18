"""agents/builder.py 테스트. core.maze에 의존하지 않고 가짜 path_fn(BFS)을 주입한다."""

from collections import deque

import numpy as np
import pytest

import config
from agents.builder import ACTION_NAMES, SarsaBuilder, RuleBasedBuilder

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
    """성적표 흉내. 필요한 키만 채운다."""
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
    return [RuleBasedBuilder(rng_a, path_fn=fake_path), SarsaBuilder(rng_b, path_fn=fake_path)]


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


def test_sarsa_builder_learn_changes_q_table():
    builder = SarsaBuilder(np.random.default_rng(3), path_fn=fake_path)
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


def test_sarsa_builder_falls_back_to_other_actions():
    # 벽이 하나도 없는 미로에서는 행동 3(벽 제거)이 None이지만 다른 행동으로 edit를 낸다.
    grid = np.zeros((5, 5), dtype=int)
    for seed in range(30):
        builder = SarsaBuilder(np.random.default_rng(seed), path_fn=fake_path)
        # 행동 3의 Q값을 가장 크게 만들어 먼저 시도되게 한다.
        builder.q_table[:, :, 3] = 10.0
        edit = builder.propose_edit(grid, (0, 0), (4, 4), make_report(0.5))
        assert edit is not None
        assert edit["type"] == "add_wall"
        assert builder.last_action in (0, 1, 2)


def _rng(seed):
    return np.random.default_rng(config.SEED + config.SEED_OFFSET["builder"] + seed)


def test_sarsa_builder_learn_sets_pending_and_next_propose_uses_it(monkeypatch):
    monkeypatch.setattr(config, "BUILDER_EPSILON", 0.0)  # a'는 항상 Q값 최대 행동
    grid = make_grid()
    start, goal = (0, 0), (4, 4)
    for seed in range(20):
        builder = SarsaBuilder(_rng(seed), path_fn=fake_path)
        assert builder.pending_action is None and builder.pending_state is None

        builder.propose_edit(grid, start, goal, make_report(0.5))  # 첫 수정은 ε-greedy
        assert builder.last_action is not None

        # s' = (2, 0) 의 Q값을 직접 정해 a' = 1 이 되게 한다.
        builder.q_table[2, 0] = [0.0, 5.0, 1.0, 2.0]
        next_report = make_report(0.9, path_len=8)
        builder.learn(make_report(0.5), next_report, edit_reverted=False)
        assert builder.pending_state == (2, 0)
        assert builder.pending_action == 1

        edit = builder.propose_edit(grid, start, goal, next_report)
        assert edit is not None
        assert builder.last_state == (2, 0)
        assert builder.last_action == 1  # pending_action을 그대로 실행
        assert edit["type"] == "add_wall"
        assert edit["pos"] in fake_path(grid, start, goal)[1:-1]


def test_sarsa_builder_update_uses_chosen_action_value_not_max(monkeypatch):
    monkeypatch.setattr(config, "BUILDER_EPSILON", 1.0)  # a'가 무작위라 최대 행동이 아닐 수 있다
    q_next = [1.0, 5.0, 0.5, 2.0]  # s' = (2, 0) 의 Q값. 최대는 행동 1 (5.0)
    s, a = (1, 0), 2
    not_greedy = 0
    for seed in range(30):
        builder = SarsaBuilder(_rng(seed), path_fn=fake_path)
        builder.last_state, builder.last_action = s, a
        builder.q_table[s][a] = 0.5
        builder.q_table[2, 0] = q_next

        reward = builder.learn(None, make_report(0.9, path_len=8), edit_reverted=False)
        assert reward == pytest.approx(0.0)

        a_next = builder.pending_action
        alpha, gamma = config.BUILDER_ALPHA, config.BUILDER_GAMMA
        sarsa_value = 0.5 + alpha * (reward + gamma * q_next[a_next] - 0.5)
        assert builder.q_table[s][a] == pytest.approx(sarsa_value)

        if a_next != 1:
            not_greedy += 1
            q_learning_value = 0.5 + alpha * (reward + gamma * max(q_next) - 0.5)
            assert builder.q_table[s][a] != pytest.approx(q_learning_value)
    assert not_greedy > 0  # 최대가 아닌 행동이 뽑힌 경우를 실제로 확인했다


def test_sarsa_builder_pending_action_falls_back_by_q_order(monkeypatch):
    monkeypatch.setattr(config, "BUILDER_EPSILON", 0.0)
    grid = np.zeros((5, 5), dtype=int)  # 벽이 없어 행동 3(벽 제거)은 edit를 못 낸다
    builder = SarsaBuilder(_rng(0), path_fn=fake_path)
    builder.pending_action = 3
    builder.q_table[1, 0] = [1.0, 3.0, 2.0, 9.0]  # 상태 (1, 0)

    edit = builder.propose_edit(grid, (0, 0), (4, 4), make_report(0.5, path_len=8))

    assert edit is not None and edit["type"] == "add_wall"
    assert builder.last_state == (1, 0)
    assert builder.last_action == 1  # 3 실패 후 Q값 순서(1 → 2 → 0)의 첫 행동, 실제 실행한 행동 기록


def test_sarsa_builder_learn_without_edit_only_sets_pending():
    builder = SarsaBuilder(_rng(0), path_fn=fake_path)
    # 첫 라운드(report None)라 수정이 없으면 last_action은 None이고 Q는 바뀌지 않는다.
    assert builder.propose_edit(make_grid(), (0, 0), (4, 4), None) is None
    builder.learn(None, make_report(0.5), edit_reverted=False)
    assert not builder.q_table.any()
    assert builder.pending_action is not None


def test_action_names_match_interface():
    assert len(ACTION_NAMES) == 4
    assert ACTION_NAMES == ("block_hot", "block_path", "random_wall", "remove_wall")


def test_last_action_name_matches_last_action():
    grid = make_grid()
    start, goal = (0, 0), (4, 4)
    for seed in range(20):
        for builder in make_builders(seed):
            assert builder.last_action is None and builder.last_action_name is None
            for report in ALL_REPORTS:
                builder.propose_edit(grid, start, goal, report)
                if builder.last_action is None:
                    assert builder.last_action_name is None
                else:
                    assert builder.last_action_name == ACTION_NAMES[builder.last_action]

    # 첫 라운드(report=None)는 수정이 없으므로 이름도 None
    builder = RuleBasedBuilder(_rng(0), path_fn=fake_path)
    builder.propose_edit(grid, start, goal, make_report(0.5))
    assert builder.last_action_name == "random_wall"
    builder.propose_edit(grid, start, goal, None)
    assert builder.last_action_name is None


def test_rule_builder_action_names_by_success_bin():
    grid = make_grid()
    start, goal = (0, 0), (4, 4)
    expected = {
        0.1: "remove_wall",
        0.5: "random_wall",
    }
    for rate, name in expected.items():
        builder = RuleBasedBuilder(_rng(1), path_fn=fake_path)
        builder.propose_edit(grid, start, goal, make_report(rate))
        assert builder.last_action_name == name
    builder = RuleBasedBuilder(_rng(1), path_fn=fake_path)
    builder.propose_edit(grid, start, goal, make_report(0.9, path_len=8))
    assert builder.last_action_name == "block_path"
    builder = RuleBasedBuilder(_rng(1), path_fn=fake_path)
    builder.propose_edit(grid, start, goal, make_report(0.9, path_len=15))
    assert builder.last_action_name == "block_hot"
