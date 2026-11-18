"""미로 환경의 상태 전이와 보상 계약을 검증한다."""

import numpy as np
import pytest

from core.environment import MazeEnv, config
from core.maze import EMPTY, WALL


@pytest.mark.parametrize("action", [0, 3])
def test_wall_and_boundary(action):
    """벽 또는 경계로 향하는 행동의 상태와 보상을 검증한다."""
    grid = np.array([[EMPTY, WALL], [EMPTY, EMPTY]])
    env = MazeEnv(grid, (0, 0), (1, 1), 4)
    assert env.step(action) == (
        (0, 0), config.REWARD_WALL_BUMP, False,
        {"result": None, "hit_wall": True, "steps": 1},
    )


def test_goal_and_reset():
    """정상 이동, 출구 도착, 초기화 뒤의 걸음 수를 검증한다."""
    env = MazeEnv(np.zeros((2, 2), dtype=int), (0, 0), (1, 1), 4)
    assert env.step(1) == (
        (1, 0), config.REWARD_STEP, False,
        {"result": None, "hit_wall": False, "steps": 1},
    )
    assert env.step(3) == (
        (1, 1), config.REWARD_GOAL, True,
        {"result": "goal", "hit_wall": False, "steps": 2},
    )
    assert env.reset() == (0, 0)
    assert env.step(1)[3]["steps"] == 1


def test_timeout_adds_penalty():
    """최대 걸음에서 해당 행동 보상에 시간 초과 벌점을 더하는지 검증한다."""
    env = MazeEnv(np.zeros((2, 2), dtype=int), (0, 0), (1, 1), 1)
    assert env.step(0) == (
        (0, 0), config.REWARD_WALL_BUMP + config.REWARD_TIMEOUT, True,
        {"result": "timeout", "hit_wall": True, "steps": 1},
    )


def test_set_grid_keeps_size():
    """같은 크기의 격자를 교체하고 다른 크기를 거부하는지 검증한다."""
    env = MazeEnv(np.zeros((2, 2), dtype=int), (0, 0), (1, 1), 4)
    replacement = np.array([[EMPTY, WALL], [EMPTY, EMPTY]])
    assert env.set_grid(replacement) is None
    assert env.step(3)[3]["hit_wall"] is True
    with pytest.raises(ValueError):
        env.set_grid(np.zeros((3, 3), dtype=int))
    assert env.grid is replacement
