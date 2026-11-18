"""미로의 상태 전이와 에피소드 보상을 처리한다."""

from types import SimpleNamespace

from core.maze import WALL

try:
    import config
except ModuleNotFoundError as error:
    if error.name != "config":
        raise
    config = SimpleNamespace(
        REWARD_STEP=-1, REWARD_WALL_BUMP=-3, REWARD_GOAL=100, REWARD_TIMEOUT=-50,
    )

_DIRECTIONS = ((-1, 0), (1, 0), (0, -1), (0, 1))


class MazeEnv:
    """고정 크기 미로에서 한 Solver의 에피소드를 실행한다."""

    def __init__(self, grid, start, goal, max_steps):
        """격자, 시작·출구 좌표, 최대 걸음 수로 환경을 초기화한다."""
        self.grid = grid
        self.size = grid.shape[0]
        self.start = start
        self.goal = goal
        self.max_steps = max_steps
        self.reset()

    def reset(self):
        """위치와 걸음 수를 초기화하고 시작 좌표를 반환한다."""
        self._state = self.start
        self._steps = 0
        return self._state

    def step(self, action):
        """방향 번호를 받아 다음 좌표, 보상, 종료 여부, 상세 정보를 반환한다."""
        if action not in range(len(_DIRECTIONS)):
            raise ValueError("행동은 0부터 3까지의 방향 번호여야 합니다.")
        row, col = self._state
        dr, dc = _DIRECTIONS[action]
        row, col = row + dr, col + dc
        self._steps += 1
        hit_wall = (
            not (0 <= row < self.size and 0 <= col < self.size)
            or self.grid[row, col] == WALL
        )
        result = None
        if hit_wall:
            reward = config.REWARD_WALL_BUMP
        else:
            self._state = (row, col)
            if self._state == self.goal:
                result = "goal"
                reward = config.REWARD_GOAL
            else:
                reward = config.REWARD_STEP

        if self._steps >= self.max_steps and result is None:
            result = "timeout"
            reward += config.REWARD_TIMEOUT

        info = {"result": result, "hit_wall": bool(hit_wall), "steps": self._steps}
        return self._state, reward, result is not None, info

    def set_grid(self, grid):
        """크기가 같은 격자로 교체하고 None을 반환한다."""
        if grid.shape != self.grid.shape:
            raise ValueError("교체할 미로는 기존 미로와 같은 크기여야 합니다.")
        self.grid = grid
