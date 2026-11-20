"""고정 미로의 격자와 출구 도달 가능성을 검증한다."""

import numpy as np

from core.fixed_maze import get_fixed_grid
from core.maze import EMPTY, WALL, is_solvable


def test_fixed_grid_is_solvable_and_independent():
    """초기 배치가 풀 수 있고 격자 수정이 다음 호출에 전파되지 않는지 검증한다."""
    grid = get_fixed_grid()
    original = get_fixed_grid()
    assert grid.shape == (15, 15)
    assert set(np.unique(grid)) == {EMPTY, WALL}
    assert is_solvable(grid, (0, 0), (14, 14))
    grid[0, 0] = WALL
    np.testing.assert_array_equal(get_fixed_grid(), original)
