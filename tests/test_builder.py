"""agents/builder.py 테스트. 기본 테스트는 core.maze에 의존하지 않고 가짜 path_fn(BFS)을 주입한다."""

from collections import deque

import numpy as np
import pytest

import config
from agents.builder import ACTION_NAMES, SarsaBuilder, RuleBasedBuilder

EMPTY, WALL = 0, 1
BUILDER_EDIT_TYPES = {"add_wall", "move_wall"}  # 제작 AI가 내는 수정 종류 (remove_wall은 내지 않는다)


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


def apply_fake(grid, edit):
    """테스트용 edit 적용 (복사본). core.maze.apply_edit와 같은 규칙으로 검증한다."""
    new_grid = grid.copy()
    if edit["type"] == "add_wall":
        assert new_grid[edit["pos"]] == EMPTY
        new_grid[edit["pos"]] = WALL
    elif edit["type"] == "move_wall":
        assert new_grid[edit["from"]] == WALL and new_grid[edit["pos"]] == EMPTY
        new_grid[edit["from"]] = EMPTY
        new_grid[edit["pos"]] = WALL
    else:
        raise AssertionError(f"제작 AI가 내면 안 되는 수정 종류: {edit['type']}")
    return new_grid


def path_len(grid):
    n = grid.shape[0]
    path = fake_path(grid, (0, 0), (n - 1, n - 1))
    return None if path is None else len(path) - 1


def make_report(rate, path_len=8, n=5, visits=None):
    """성적표 흉내. 필요한 키만 채운다."""
    if visits is None:
        visits = np.arange(n * n).reshape(n, n)
    return {
        "algo": "q",
        "success_rate": rate,
        "shortest_path_len": path_len,
        "visit_counts": visits,
    }


def make_grid(n=5, walls=((1, 1), (2, 3), (3, 1))):
    grid = np.zeros((n, n), dtype=int)
    for pos in walls:
        grid[pos] = WALL
    return grid


def random_grid(n, seed):
    """config.WALL_DENSITY 비율로 벽을 놓은, 출구까지 길이 있는 무작위 미로 (core.maze 없이)."""
    rng = np.random.default_rng(seed)
    start, goal = (0, 0), (n - 1, n - 1)
    cells = [(r, c) for r in range(n) for c in range(n) if (r, c) not in (start, goal)]
    count = int(n * n * config.WALL_DENSITY[n])
    while True:
        grid = np.zeros((n, n), dtype=int)
        for i in rng.choice(len(cells), size=count, replace=False):
            grid[cells[i]] = WALL
        if fake_path(grid, start, goal) is not None:
            return grid


def _rng(seed):
    return np.random.default_rng(config.SEED + config.SEED_OFFSET["builder"] + seed)


def make_builders(seed):
    return [RuleBasedBuilder(_rng(seed), path_fn=fake_path), SarsaBuilder(_rng(seed), path_fn=fake_path)]


# 성공률 구간 0/1/2 × 최단 경로 구간 0/1/2 를 모두 만드는 성적표들
ALL_REPORTS = [make_report(r, p) for r in (0.1, 0.5, 0.9) for p in (8, 11, 15)]


def check_edit_format(edit, grid, n):
    """edit가 interface.md 4번 형식(add_wall 또는 move_wall)인지 검증한다."""
    assert isinstance(edit, dict)
    assert edit["type"] in BUILDER_EDIT_TYPES
    keys = {"type", "pos"} if edit["type"] == "add_wall" else {"type", "from", "pos"}
    assert set(edit.keys()) == keys
    coords = [edit["pos"]] + ([edit["from"]] if edit["type"] == "move_wall" else [])
    for coord in coords:
        assert isinstance(coord, tuple) and len(coord) == 2
        assert all(isinstance(v, int) for v in coord)
        assert 0 <= coord[0] < n and 0 <= coord[1] < n
    assert grid[edit["pos"]] == EMPTY  # 벽을 세울 칸은 빈칸
    if edit["type"] == "move_wall":
        assert grid[edit["from"]] == WALL  # 비울 칸은 기존 벽
        assert edit["from"] != edit["pos"]


# ----------------------------------------------------------------------
# 수정 형식·안전 규칙
# ----------------------------------------------------------------------
def test_propose_edit_returns_valid_format():
    grid = make_grid()
    start, goal = (0, 0), (4, 4)
    for seed in range(20):
        for builder in make_builders(seed):
            for report in ALL_REPORTS:
                edit = builder.propose_edit(grid, start, goal, report)
                assert edit is not None
                check_edit_format(edit, grid, 5)


def test_first_round_returns_none():
    for builder in make_builders(0):
        assert builder.propose_edit(make_grid(), (0, 0), (4, 4), None) is None
        assert builder.last_state is None
        assert builder.last_action is None


def test_never_targets_start_or_goal():
    start, goal = (0, 0), (4, 4)
    sparse = np.ones((5, 5), dtype=int)  # 시작점·출구와 길 한 줄만 비어 있는 미로
    for pos in [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4), (1, 4), (2, 4), (3, 4), (4, 4)]:
        sparse[pos] = EMPTY
    grids = [make_grid(), np.zeros((5, 5), dtype=int), sparse]
    for seed in range(50):
        for builder in make_builders(seed):
            for grid in grids:
                for report in ALL_REPORTS:
                    edit = builder.propose_edit(grid, start, goal, report)
                    if edit is None:
                        continue
                    assert edit["pos"] not in (start, goal)
                    if edit["type"] == "move_wall":
                        assert edit["from"] not in (start, goal)


def test_never_emits_remove_wall_or_trap_edit(monkeypatch):
    monkeypatch.setattr(config, "ENABLE_TRAPS", False)
    grids = [make_grid(), random_grid(5, 1), random_grid(7, 2)]
    for seed in range(10):
        for builder in make_builders(seed):
            for grid in grids:
                n = grid.shape[0]
                for report in [make_report(r, p, n=n) for r in (0.1, 0.5, 0.9) for p in (8, 11, 15)]:
                    edit = builder.propose_edit(grid, (0, 0), (n - 1, n - 1), report)
                    if edit is not None:
                        assert edit["type"] in BUILDER_EDIT_TYPES


def test_never_proposes_edit_that_blocks_the_only_path():
    # 3x3 외길: (0,0)-(0,1)-(0,2)-(1,2)-(2,2). 시작·출구를 뺀 빈칸은 모두 길 위라 벽 추가는 길을 막는다.
    # 벽 이동은 비운 칸으로 다른 길이 열리는 경우에만 가능하다. 어떤 수정이든 적용 후 길이 남아야 한다.
    grid = np.array([[0, 0, 0], [1, 1, 0], [1, 1, 0]])
    start, goal = (0, 0), (2, 2)
    assert fake_path(grid, start, goal) is not None
    for seed in range(50):
        for builder in make_builders(seed):
            for report in [make_report(r, 4, n=3) for r in (0.1, 0.5, 0.9)]:
                edit = builder.propose_edit(grid, start, goal, report)
                if edit is None:
                    continue
                assert edit["type"] == "move_wall"  # 벽 추가는 항상 길을 막으므로 나올 수 없다
                assert fake_path(apply_fake(grid, edit), start, goal) is not None

    # 빈칸이 모두 외길 위인 다른 미로: 어떤 수정이 나오든 적용 후 길이 남아야 한다.
    corridor = np.array([[0, 1, 1], [0, 1, 1], [0, 0, 0]])
    for seed in range(20):
        for builder in make_builders(seed):
            for report in [make_report(r, 4, n=3) for r in (0.1, 0.5, 0.9)]:
                edit = builder.propose_edit(corridor, (0, 0), (2, 2), report)
                if edit is not None:
                    assert fake_path(apply_fake(corridor, edit), (0, 0), (2, 2)) is not None


# ----------------------------------------------------------------------
# 매 라운드 길 막기: 벽 추가 → 상한이면 이동
# ----------------------------------------------------------------------
@pytest.mark.parametrize("size", [5, 7, 10])
def test_every_round_blocks_path_and_keeps_maze_solvable(size):
    start, goal = (0, 0), (size - 1, size - 1)
    cap = int(config.BUILDER_MAX_WALL_DENSITY[size] * size * size)
    saw_add = saw_move = False
    for seed in range(4):
        for builder in make_builders(seed):
            data_rng = np.random.default_rng(seed)
            grid = random_grid(size, seed)
            report = make_report(0.9, path_len(grid), n=size, visits=data_rng.integers(0, 50, (size, size)))
            for _ in range(25):
                edit = builder.propose_edit(grid, start, goal, report)
                assert edit is not None  # 길이 남아 있는 일반 미로에서는 매 라운드 수정이 나온다
                check_edit_format(edit, grid, size)
                walls_before = int((grid == WALL).sum())
                new_grid = apply_fake(grid, edit)
                assert fake_path(new_grid, start, goal) is not None  # 이동·추가 후에도 탈출 가능
                if edit["type"] == "add_wall":
                    saw_add = True
                    assert walls_before < cap  # 추가는 상한 미만일 때만
                else:
                    saw_move = True
                    assert int((new_grid == WALL).sum()) == walls_before  # 이동은 벽 수를 바꾸지 않는다
                assert int((new_grid == WALL).sum()) <= cap
                grid = new_grid

                rate = float(data_rng.choice([0.1, 0.5, 0.9]))
                next_report = make_report(
                    rate, path_len(grid), n=size, visits=data_rng.integers(0, 50, (size, size))
                )
                builder.learn(report, next_report, edit_reverted=False)
                report = next_report
    assert saw_add and saw_move  # 추가와 이동이 모두 실제로 나왔다


# ----------------------------------------------------------------------
# 최단 경로를 줄이지 않는 수정 (길을 열어 버리는 수정 금지)
# ----------------------------------------------------------------------
@pytest.mark.parametrize("size", [5, 7, 10])
def test_edit_never_shortens_shortest_path(size):
    start, goal = (0, 0), (size - 1, size - 1)
    checked = 0
    for seed in range(3):
        for builder in make_builders(seed):
            data_rng = np.random.default_rng(100 + seed)
            grid = random_grid(size, seed)
            report = make_report(0.9, path_len(grid), n=size, visits=data_rng.integers(0, 50, (size, size)))
            for _ in range(15):
                edit = builder.propose_edit(grid, start, goal, report)
                if edit is not None:
                    new_grid = apply_fake(grid, edit)
                    assert path_len(new_grid) >= path_len(grid)  # 수정 후 최단 경로가 수정 전 이상
                    grid = new_grid
                    checked += 1
                rate = float(data_rng.choice([0.1, 0.5, 0.9]))
                next_report = make_report(
                    rate, path_len(grid), n=size, visits=data_rng.integers(0, 50, (size, size))
                )
                builder.learn(report, next_report, edit_reverted=False)
                report = next_report
    assert checked > 0


# 시작점 (0,0), 출구 (4,4). 길은 왼쪽 열 → 아래 → 가운데 열 → 위 → 오른쪽 열로 빙 돌아 16걸음이다.
# 벽을 하나 치우면 지름길이 열려 최단 경로가 짧아진다.
DETOUR_GRID = np.array(
    [
        [0, 1, 0, 0, 0],
        [0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0],
        [0, 0, 0, 1, 0],
    ]
)


def test_move_rejects_candidates_that_open_a_shortcut():
    grid = DETOUR_GRID
    start, goal = (0, 0), (4, 4)
    base = path_len(grid)
    assert base == 16

    path = fake_path(grid, start, goal)
    targets = [p for p in path[1:-1] if grid[p] == EMPTY]
    walls = [(int(r), int(c)) for r, c in zip(*np.where(grid == WALL))]
    shortening = []
    for pos in targets:
        for src in walls:
            trial = grid.copy()
            trial[src] = EMPTY
            trial[pos] = WALL
            length = path_len(trial)
            if length is not None and length < base:
                shortening.append({"type": "move_wall", "from": src, "pos": pos})
    assert shortening  # 이 미로에는 길을 열어 버리는 이동 후보가 실제로 있다

    for seed in range(20):
        rule = RuleBasedBuilder(_rng(seed), path_fn=fake_path)
        # 성공률 구간 1 → move_to_path
        edit = rule.propose_edit(grid, start, goal, make_report(0.5, path_len=base))
        if edit is not None:
            assert edit not in shortening
            assert path_len(apply_fake(grid, edit)) >= base


def test_prefers_candidate_that_lengthens_shortest_path(monkeypatch):
    # 이 미로는 벽이 5×5 상한(7개)에 닿아 있으므로, 벽 추가를 보려고 상한을 올린다.
    monkeypatch.setattr(config, "BUILDER_MAX_WALL_DENSITY", {5: 0.6, 7: 0.6, 10: 0.6})
    # 8걸음 최단 경로 위의 (2,4)·(3,4)에 벽을 세우면 가운데로 돌아가 12걸음이 된다.
    grid = np.array(
        [
            [0, 0, 0, 0, 0],
            [1, 1, 0, 1, 1],
            [0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0],
        ]
    )
    start, goal = (0, 0), (4, 4)
    base = path_len(grid)
    path = fake_path(grid, start, goal)
    targets = [p for p in path[1:-1] if grid[p] == EMPTY]

    lengths = {}
    for pos in targets:
        trial = grid.copy()
        trial[pos] = WALL
        length = path_len(trial)
        if length is not None:
            lengths[pos] = length
    best = max(lengths.values())
    assert best > base  # 길어지는 후보가 실제로 있다

    for seed in range(20):
        # 성공률 구간 2 + 경로 구간 0 → Rule은 block_path
        rule = RuleBasedBuilder(_rng(seed), path_fn=fake_path)
        edit = rule.propose_edit(grid, start, goal, make_report(0.9, path_len=base))
        assert edit["type"] == "add_wall"
        assert lengths[edit["pos"]] == best  # 우선순위(방문 횟수)와 관계없이 가장 길어지는 후보


def test_adds_wall_below_cap_and_moves_wall_at_cap():
    start, goal = (0, 0), (4, 4)
    cap = int(config.BUILDER_MAX_WALL_DENSITY[5] * 25)  # 5x5는 7개
    assert cap == 7
    easy = make_report(0.9, path_len=8)  # 성공률 구간 2, 경로 구간 0 → Rule은 block_path

    below = make_grid(walls=((1, 1), (2, 3), (3, 1)))
    at_cap = make_grid(walls=((1, 1), (2, 3), (3, 1), (1, 3), (3, 3), (2, 0), (0, 3)))
    assert int((at_cap == WALL).sum()) == cap and fake_path(at_cap, start, goal) is not None

    for hot_report in (easy, make_report(0.9, path_len=15)):  # block_path와 block_hot 모두
        for seed in range(10):
            rule = RuleBasedBuilder(_rng(seed), path_fn=fake_path)
            assert rule.propose_edit(below, start, goal, hot_report)["type"] == "add_wall"

            rule = RuleBasedBuilder(_rng(seed), path_fn=fake_path)
            edit = rule.propose_edit(at_cap, start, goal, hot_report)
            assert edit is not None and edit["type"] == "move_wall"  # 상한이면 추가 대신 이동
            assert rule.last_action in (0, 1)  # 같은 추가 행동이 이동으로 대체되었다
            assert int((apply_fake(at_cap, edit) == WALL).sum()) == cap


def test_cap_follows_config(monkeypatch):
    monkeypatch.setattr(config, "BUILDER_MAX_WALL_DENSITY", {5: 0.12, 7: 0.3, 10: 0.3})  # 5x5 상한 3개
    grid = make_grid()  # 벽 3개 = 상한
    rule = RuleBasedBuilder(_rng(0), path_fn=fake_path)
    assert rule.propose_edit(grid, (0, 0), (4, 4), make_report(0.9, path_len=8))["type"] == "move_wall"

    monkeypatch.setattr(config, "BUILDER_MAX_WALL_DENSITY", {5: 0.2, 7: 0.3, 10: 0.3})  # 상한 5개
    rule = RuleBasedBuilder(_rng(0), path_fn=fake_path)
    assert rule.propose_edit(grid, (0, 0), (4, 4), make_report(0.9, path_len=8))["type"] == "add_wall"


def test_size_missing_from_config_does_not_crash():
    # config에 없는 크기(3x3)도 설정된 최대 비율로 상한을 계산해 동작한다.
    grid = np.zeros((3, 3), dtype=int)
    builder = RuleBasedBuilder(_rng(0), path_fn=fake_path)
    edit = builder.propose_edit(grid, (0, 0), (2, 2), make_report(0.9, path_len=4, n=3))
    assert edit is not None and edit["type"] == "add_wall"


def test_move_wall_picks_wall_with_least_neighbor_visits():
    # 5x5: 벽 3개. (4,1) 주변 이웃의 방문 횟수만 0이라 가장 먼저 옮겨져야 한다.
    grid = make_grid(walls=((0, 3), (2, 2), (4, 1)))
    visits = np.full((5, 5), 10)
    for pos in [(4, 0), (3, 1), (4, 2)]:  # (4,1)의 이웃
        visits[pos] = 0
    for seed in range(10):
        rule = RuleBasedBuilder(_rng(seed), path_fn=fake_path)
        # 성공률 구간 1 → move_to_path
        edit = rule.propose_edit(grid, (0, 0), (4, 4), make_report(0.5, path_len=8, visits=visits))
        assert edit["type"] == "move_wall" and edit["from"] == (4, 1)
        assert rule.last_action_name == "move_to_path"


def test_move_to_hot_targets_most_visited_cell():
    grid = make_grid()
    visits = np.zeros((5, 5), dtype=int)
    visits[2, 2] = 999
    rule = RuleBasedBuilder(_rng(1), path_fn=fake_path)
    edit = rule.propose_edit(grid, (0, 0), (4, 4), make_report(0.1, path_len=8, visits=visits))
    assert edit["type"] == "move_wall" and edit["pos"] == (2, 2)
    assert rule.last_action_name == "move_to_hot"


def test_move_to_path_targets_shortest_path_cell():
    grid = make_grid()
    path = fake_path(grid, (0, 0), (4, 4))
    for seed in range(10):
        rule = RuleBasedBuilder(_rng(seed), path_fn=fake_path)
        edit = rule.propose_edit(grid, (0, 0), (4, 4), make_report(0.5, path_len=8))
        assert edit["type"] == "move_wall" and edit["pos"] in path[1:-1]
        assert rule.last_action_name == "move_to_path"


def test_move_actions_are_skipped_when_there_is_no_wall():
    grid = np.zeros((5, 5), dtype=int)
    for seed in range(20):
        for builder in make_builders(seed):
            for report in ALL_REPORTS:
                edit = builder.propose_edit(grid, (0, 0), (4, 4), report)
                assert edit is not None and edit["type"] == "add_wall"  # 이동 불가 → 추가 행동으로 대체
                assert builder.last_action in (0, 1)


def test_rule_builder_actions_by_success_bin():
    grid = make_grid()
    start, goal = (0, 0), (4, 4)
    path = fake_path(grid, start, goal)

    # 성공률 구간 0 (너무 어려움): 덜 치명적인 방문 많은 칸으로 벽 이동
    b = RuleBasedBuilder(np.random.default_rng(1), path_fn=fake_path)
    edit = b.propose_edit(grid, start, goal, make_report(0.1))
    assert edit["type"] == "move_wall" and b.last_action == 3 and b.last_state[0] == 0

    # 성공률 구간 1 (적당): 벽을 최단 경로 위 칸으로 이동
    b = RuleBasedBuilder(np.random.default_rng(1), path_fn=fake_path)
    edit = b.propose_edit(grid, start, goal, make_report(0.5))
    assert edit["type"] == "move_wall" and b.last_action == 2 and b.last_state[0] == 1
    assert edit["pos"] in path[1:-1]

    # 성공률 구간 2 + 최단 경로 구간 0 (8 / 8 = 1.0): 최단 경로 위의 칸에 벽 추가
    b = RuleBasedBuilder(np.random.default_rng(1), path_fn=fake_path)
    edit = b.propose_edit(grid, start, goal, make_report(0.9, path_len=8))
    assert edit["type"] == "add_wall" and b.last_action == 1
    assert b.last_state == (2, 0)
    assert edit["pos"] in path[1:-1]

    # 성공률 구간 2 + 최단 경로 구간 2: 가장 많이 방문된 빈칸에 벽 추가
    visits = np.zeros((5, 5), dtype=int)
    visits[2, 2] = 999
    b = RuleBasedBuilder(np.random.default_rng(1), path_fn=fake_path)
    edit = b.propose_edit(grid, start, goal, make_report(0.9, path_len=15, visits=visits))
    assert edit == {"type": "add_wall", "pos": (2, 2)} and b.last_action == 0
    assert b.last_state == (2, 2)


# ----------------------------------------------------------------------
# 보상 (변경 없음)
# ----------------------------------------------------------------------
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


# ----------------------------------------------------------------------
# SARSA 학습 흐름 (변경 없음)
# ----------------------------------------------------------------------
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
    # 벽이 하나도 없는 미로에서는 이동 행동(2, 3)이 None이지만 다른 행동으로 edit를 낸다.
    grid = np.zeros((5, 5), dtype=int)
    for seed in range(30):
        builder = SarsaBuilder(_rng(seed), path_fn=fake_path)
        # 행동 3의 Q값을 가장 크게 만들어 먼저 시도되게 한다.
        builder.q_table[:, :, 3] = 10.0
        edit = builder.propose_edit(grid, (0, 0), (4, 4), make_report(0.5))
        assert edit is not None
        assert edit["type"] == "add_wall"
        assert builder.last_action in (0, 1)


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
    grid = np.zeros((5, 5), dtype=int)  # 벽이 없어 행동 3(move_to_hot)은 edit를 못 낸다
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


# ----------------------------------------------------------------------
# 행동 이름
# ----------------------------------------------------------------------
def test_action_names_match_interface():
    assert len(ACTION_NAMES) == 4
    assert ACTION_NAMES == ("block_hot", "block_path", "move_to_path", "move_to_hot")


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
    assert builder.last_action_name == "move_to_path"
    builder.propose_edit(grid, start, goal, None)
    assert builder.last_action_name is None


def test_rule_builder_action_names_by_success_bin():
    grid = make_grid()
    start, goal = (0, 0), (4, 4)
    cases = [
        (make_report(0.1), "move_to_hot"),
        (make_report(0.5), "move_to_path"),
        (make_report(0.9, path_len=8), "block_path"),
        (make_report(0.9, path_len=15), "block_hot"),
    ]
    for report, name in cases:
        builder = RuleBasedBuilder(_rng(1), path_fn=fake_path)
        builder.propose_edit(grid, start, goal, report)
        assert builder.last_action_name == name


# ----------------------------------------------------------------------
# 실제 core.maze 통합 테스트: core.maze.apply_edit가 move_wall을 지원할 때만 실행된다
# ----------------------------------------------------------------------
@pytest.fixture
def maze():
    """core.maze가 없거나 apply_edit가 move_wall을 아직 지원하지 않으면 건너뛴다."""
    module = pytest.importorskip("core.maze")
    probe = np.zeros((3, 3), dtype=int)
    probe[1, 1] = WALL
    try:
        module.apply_edit(probe, {"type": "move_wall", "from": (1, 1), "pos": (1, 0)})
    except (ValueError, KeyError):
        pytest.skip("core.maze.apply_edit가 move_wall을 아직 지원하지 않는다")
    return module


def _real_report(maze, grid, rate, rng):
    """실제 미로에서 shortest_path_len을 계산하고 visit_counts는 무작위로 만든 성적표."""
    n = grid.shape[0]
    return {
        "algo": "q",
        "success_rate": rate,
        "shortest_path_len": maze.shortest_path_len(grid, (0, 0), (n - 1, n - 1)),
        "visit_counts": rng.integers(0, 50, size=(n, n)),
    }


def test_integration_uses_core_maze_defaults(maze):
    import agents.builder as builder_module

    assert builder_module.EMPTY == maze.EMPTY
    assert builder_module.WALL == maze.WALL
    for builder_cls in (RuleBasedBuilder, SarsaBuilder):
        assert builder_cls(_rng(0))._get_path_fn() is maze.shortest_path  # path_fn 기본값


@pytest.mark.parametrize("size", [5, 7, 10])
@pytest.mark.parametrize("builder_cls", [RuleBasedBuilder, SarsaBuilder])
def test_integration_every_round_edit_keeps_maze_solvable(maze, size, builder_cls):
    start, goal = (0, 0), (size - 1, size - 1)
    cap = int(config.BUILDER_MAX_WALL_DENSITY[size] * size * size)
    saw_move = False
    for seed in range(5):
        maze_rng = np.random.default_rng(config.SEED + config.SEED_OFFSET["maze"] + seed)
        data_rng = np.random.default_rng(1000 + seed)
        builder = builder_cls(_rng(seed))  # 실제 core.maze.shortest_path 사용
        grid = maze.generate_maze(size, maze_rng)
        report = _real_report(maze, grid, 0.9, data_rng)

        for _ in range(30):
            before = grid.copy()
            edit = builder.propose_edit(grid, start, goal, report)
            assert np.array_equal(grid, before)  # propose_edit는 원본 미로를 바꾸지 않는다
            assert edit is not None  # 매 라운드 길을 막는 수정이 나온다
            check_edit_format(edit, grid, size)
            assert edit["pos"] not in (start, goal)  # 시작점·출구는 수정 대상이 아니다
            if edit["type"] == "move_wall":
                assert edit["from"] not in (start, goal)
            new_grid = maze.apply_edit(grid, edit)  # ValueError 없이 적용
            assert maze.is_solvable(new_grid, start, goal)
            assert new_grid[start] == EMPTY and new_grid[goal] == EMPTY
            # 길을 열어 최단 경로를 줄이는 수정은 내지 않는다
            assert maze.shortest_path_len(new_grid, start, goal) >= maze.shortest_path_len(grid, start, goal)
            assert int((new_grid == WALL).sum()) <= cap
            saw_move = saw_move or edit["type"] == "move_wall"
            grid = new_grid

            # 대표 성공률 3개와 무작위 성공률을 섞어 모든 상태 구간을 만든다
            rate = float(data_rng.choice([0.1, 0.5, 0.9, data_rng.random()]))
            next_report = _real_report(maze, grid, rate, data_rng)
            builder.learn(report, next_report, edit_reverted=False)
            report = next_report
    assert saw_move  # 상한에 닿아 벽 이동이 실제로 나왔다
