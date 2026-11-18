"""고정 미로의 배치와 이동을 검증한다."""

import pytest

from core.passage_maze import get_fixed_maze


@pytest.mark.parametrize("size, count", [(5, 10), (7, 25), (10, 50)])
def test_fixed_layout(size, count):
    """벽 개수, 고정 배치, 양방향 차단과 출구 도달 여부를 검증한다."""
    maze = get_fixed_maze(size)
    assert maze == get_fixed_maze(size)
    assert len(maze.walls) == count
    path = maze.shortest_path()
    assert path is not None
    assert (path[0], path[-1]) == (maze.start, maze.goal)
    assert all(maze.can_move(a, b) for a, b in zip(path, path[1:]))
    for a, b in maze.walls:
        assert a < b
        assert all(0 <= coordinate < size for coordinate in (*a, *b))
        assert abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1
        assert not maze.can_move(a, b)
        assert not maze.can_move(b, a)


def test_distinct_endpoints():
    """세 시대에서 시작과 목표 좌표가 각각 다른지 검증한다."""
    maps = [get_fixed_maze(size) for size in (5, 7, 10)]
    assert len({maze.start for maze in maps}) == 3
    assert len({maze.goal for maze in maps}) == 3


@pytest.mark.parametrize("size", [5, 7, 10])
def test_two_separate_routes(size):
    """중간 칸을 공유하지 않는 두 출구 경로가 열려 있는지 확인한다."""
    maze = get_fixed_maze(size)
    top, left = maze.start
    bottom, right = maze.goal
    across = [(top, c) for c in range(left, right + 1)]
    across += [(r, right) for r in range(top + 1, bottom + 1)]
    down = [(r, left) for r in range(top, bottom + 1)]
    down += [(bottom, c) for c in range(left + 1, right + 1)]
    assert set(across[1:-1]).isdisjoint(down[1:-1])
    for path in (across, down):
        assert (path[0], path[-1]) == (maze.start, maze.goal)
        assert all(maze.can_move(a, b) for a, b in zip(path, path[1:]))
