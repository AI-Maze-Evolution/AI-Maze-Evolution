"""미로 표현, 탐색, 생성 및 수정 도구."""

from collections import deque

import numpy as np

try:
    import config
except ModuleNotFoundError as error:
    if error.name != "config":
        raise
    config = None

EMPTY = 0
WALL = 1
TRAP = 2

# 공통 config.py가 추가되면 제거할 임시 설정이다.
_DEFAULT_WALL_DENSITY = {5: 0.2, 7: 0.25, 10: 0.3}
_DEFAULT_ENABLE_TRAPS = False
_DIRECTIONS = ((-1, 0), (1, 0), (0, -1), (0, 1))


def _is_open(grid, position):
    """격자와 좌표를 받아 해당 좌표를 통과할 수 있는지 반환한다."""
    row, col = position
    return (
        0 <= row < grid.shape[0]
        and 0 <= col < grid.shape[1]
        and grid[row, col] == EMPTY
    )


def is_solvable(grid, start, goal):
    """격자에서 시작점부터 출구까지 이동할 수 있는지 반환한다."""
    return shortest_path(grid, start, goal) is not None


def shortest_path(grid, start, goal):
    """격자와 양 끝 좌표를 받아 양 끝을 포함한 최단 경로 또는 None을 반환한다."""
    if not _is_open(grid, start) or not _is_open(grid, goal):
        return None

    parents = {start: None}
    pending = deque([start])
    while pending:
        current = pending.popleft()
        if current == goal:
            path = []
            while current is not None:
                path.append(current)
                current = parents[current]
            return path[::-1]

        row, col = current
        for row_delta, col_delta in _DIRECTIONS:
            neighbor = (row + row_delta, col + col_delta)
            if neighbor not in parents and _is_open(grid, neighbor):
                parents[neighbor] = current
                pending.append(neighbor)
    return None


def shortest_path_len(grid, start, goal):
    """격자와 양 끝 좌표를 받아 최단 이동 횟수 또는 None을 반환한다."""
    path = shortest_path(grid, start, goal)
    return None if path is None else len(path) - 1


def generate_maze(size, rng):
    """미로 크기와 NumPy 난수 생성기를 받아 풀 수 있는 정수 격자를 반환한다."""
    densities = _DEFAULT_WALL_DENSITY if config is None else config.WALL_DENSITY
    wall_count = int(size * size * densities[size])
    if not 0 <= wall_count <= (size - 1) ** 2:
        raise ValueError("지정한 벽 비율로는 출구까지의 경로를 만들 수 없습니다.")

    start = (0, 0)
    goal = (size - 1, size - 1)
    while True:
        grid = np.full((size, size), EMPTY, dtype=int)
        walls = rng.choice(max(size * size - 2, 0), size=wall_count, replace=False) + 1
        grid.flat[walls] = WALL
        if is_solvable(grid, start, goal):
            return grid


def apply_edit(grid, edit):
    """격자와 수정 요청을 받아 원본을 보존한 채 수정된 복사본을 반환한다."""
    edit_type = edit["type"]
    row, col = edit["pos"]
    height, width = grid.shape
    if not (0 <= row < height and 0 <= col < width):
        raise ValueError("수정 좌표가 미로 밖에 있습니다.")
    if (row, col) in ((0, 0), (height - 1, width - 1)):
        raise ValueError("시작점과 출구는 수정할 수 없습니다.")

    traps_enabled = _DEFAULT_ENABLE_TRAPS if config is None else config.ENABLE_TRAPS
    if edit_type in ("add_trap", "remove_trap") and not traps_enabled:
        raise ValueError("함정 기능이 비활성화되어 있습니다.")
    if edit_type == "add_wall":
        value = WALL
    elif edit_type == "remove_wall":
        value = EMPTY
    else:
        raise ValueError(f"지원하지 않는 수정 유형입니다: {edit_type}")

    new_grid = grid.copy()
    new_grid[row, col] = value
    return new_grid
