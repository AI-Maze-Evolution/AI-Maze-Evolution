"""미로 도구의 공개 인터페이스를 검증한다."""

import numpy as np
import pytest

from core.maze import (
    EMPTY,
    TRAP,
    WALL,
    apply_edit,
    generate_maze,
    is_solvable,
    shortest_path,
    shortest_path_len,
)


def test_shortest_path_includes_endpoints():
    """최단 경로에 양 끝점이 포함되고 걸음 수가 맞는지 검증한다."""
    grid = np.array([[EMPTY, WALL, EMPTY], [EMPTY, TRAP, EMPTY], [EMPTY, EMPTY, EMPTY]])
    start, goal = (0, 0), (2, 2)

    assert shortest_path(grid, start, goal) == [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2)]
    assert shortest_path_len(grid, start, goal) == 4
    assert is_solvable(grid, start, goal) is True
    assert shortest_path_len(grid, start, start) == 0


@pytest.mark.parametrize("obstacle", [WALL, TRAP])
def test_unreachable_goal(obstacle):
    """장애물 값을 받아 출구로 가는 길이 차단될 때의 반환값을 검증한다."""
    grid = np.array([[EMPTY, obstacle], [obstacle, EMPTY]])
    start, goal = (0, 0), (1, 1)

    assert is_solvable(grid, start, goal) is False
    assert shortest_path(grid, start, goal) is None
    assert shortest_path_len(grid, start, goal) is None


@pytest.mark.parametrize("size", [5, 7, 10])
def test_generate_maze_is_solvable(size):
    """크기를 받아 생성한 격자의 형식과 출구까지의 연결을 검증한다."""
    rng = np.random.default_rng(42)
    for _ in range(5):
        grid = generate_maze(size, rng)
        start, goal = (0, 0), (size - 1, size - 1)
        assert grid.shape == (size, size)
        assert np.issubdtype(grid.dtype, np.integer)
        assert set(np.unique(grid)) <= {EMPTY, WALL}
        assert grid[start] == grid[goal] == EMPTY
        assert is_solvable(grid, start, goal)


def test_apply_edit_preserves_original():
    """벽을 추가하고 삭제할 때 입력 격자가 보존되는지 검증한다."""
    grid = np.full((3, 3), EMPTY, dtype=int)
    pos = (1, 1)
    with_wall = apply_edit(grid, {"type": "add_wall", "pos": pos})
    without_wall = apply_edit(with_wall, {"type": "remove_wall", "pos": pos})

    assert grid[pos] == EMPTY
    assert with_wall[pos] == WALL
    assert without_wall[pos] == EMPTY


@pytest.mark.parametrize("pos", [(0, 0), (2, 2)])
def test_apply_edit_protects_endpoints(pos):
    """시작점이나 출구 좌표를 받아 해당 칸의 수정이 거부되는지 검증한다."""
    grid = np.full((3, 3), EMPTY, dtype=int)
    with pytest.raises(ValueError):
        apply_edit(grid, {"type": "add_wall", "pos": pos})


@pytest.mark.parametrize("edit_type", ["add_trap", "remove_trap"])
def test_apply_edit_rejects_traps(edit_type):
    """예약된 함정 수정 유형을 받아 해당 요청이 거부되는지 검증한다."""
    grid = np.full((3, 3), EMPTY, dtype=int)
    with pytest.raises(ValueError):
        apply_edit(grid, {"type": edit_type, "pos": (1, 1)})
