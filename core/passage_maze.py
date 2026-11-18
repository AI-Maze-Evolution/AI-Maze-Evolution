"""시대별 고정 미로와 통로 벽 사이의 이동을 정의한다."""

from collections import deque
from dataclasses import dataclass

Position = tuple[int, int]
Passage = tuple[Position, Position]
_DIRECTIONS = ((-1, 0), (1, 0), (0, -1), (0, 1))


@dataclass(frozen=True)
class PassageMaze:
    """시작점, 목표점, 양방향 통로 벽이 고정된 미로다."""

    size: int
    start: Position
    goal: Position
    walls: frozenset[Passage]

    def _contains(self, pos: Position) -> bool:
        """좌표가 미로 안에 있는지 반환한다."""
        return all(0 <= coordinate < self.size for coordinate in pos)

    def can_move(self, start: Position, end: Position) -> bool:
        """두 좌표가 인접하고 그 사이 통로가 열렸는지 반환한다."""
        if not self._contains(start) or not self._contains(end):
            return False
        if abs(start[0] - end[0]) + abs(start[1] - end[1]) != 1:
            return False
        passage = (start, end) if start < end else (end, start)
        return passage not in self.walls

    def shortest_path(self) -> list[Position] | None:
        """고정 시작점에서 목표점까지 최단 경로 또는 None을 반환한다."""
        pending = deque([self.start])
        parents: dict[Position, Position | None] = {self.start: None}
        while pending:
            current = pending.popleft()
            if current == self.goal:
                path = []
                node: Position | None = current
                while node is not None:
                    path.append(node)
                    node = parents[node]
                return path[::-1]
            for dr, dc in _DIRECTIONS:
                neighbor = (current[0] + dr, current[1] + dc)
                if neighbor not in parents and self.can_move(current, neighbor):
                    parents[neighbor] = current
                    pending.append(neighbor)
        return None


# 초기 벽은 실행 시 재배치하지 않는다. 두 출구 경로를 남긴 고정 좌표다.
_FIXED_MAZES = {
    5: PassageMaze(5, (0, 1), (4, 3), frozenset({
        ((1, 0), (2, 0)),
        ((1, 2), (2, 2)),
        ((1, 4), (2, 4)),
        ((2, 0), (3, 0)),
        ((2, 2), (3, 2)),
        ((2, 3), (2, 4)),
        ((3, 1), (3, 2)),
        ((3, 2), (3, 3)),
        ((3, 2), (4, 2)),
        ((3, 3), (3, 4)),
    })),
    7: PassageMaze(7, (1, 0), (5, 6), frozenset({
        ((0, 0), (0, 1)),
        ((0, 0), (1, 0)),
        ((0, 3), (0, 4)),
        ((0, 3), (1, 3)),
        ((0, 4), (0, 5)),
        ((0, 5), (1, 5)),
        ((1, 2), (2, 2)),
        ((1, 3), (2, 3)),
        ((1, 5), (2, 5)),
        ((2, 0), (2, 1)),
        ((2, 1), (3, 1)),
        ((2, 2), (2, 3)),
        ((2, 2), (3, 2)),
        ((2, 4), (2, 5)),
        ((2, 5), (3, 5)),
        ((3, 1), (3, 2)),
        ((4, 1), (4, 2)),
        ((4, 2), (4, 3)),
        ((4, 2), (5, 2)),
        ((4, 4), (4, 5)),
        ((5, 0), (6, 0)),
        ((5, 2), (6, 2)),
        ((5, 5), (6, 5)),
        ((6, 2), (6, 3)),
        ((6, 3), (6, 4)),
    })),
    10: PassageMaze(10, (2, 1), (8, 7), frozenset({
        ((0, 0), (1, 0)),
        ((0, 1), (0, 2)),
        ((0, 1), (1, 1)),
        ((0, 3), (1, 3)),
        ((0, 4), (1, 4)),
        ((0, 5), (0, 6)),
        ((0, 7), (0, 8)),
        ((0, 7), (1, 7)),
        ((0, 8), (1, 8)),
        ((0, 9), (1, 9)),
        ((1, 3), (1, 4)),
        ((1, 4), (1, 5)),
        ((1, 6), (1, 7)),
        ((1, 6), (2, 6)),
        ((1, 8), (1, 9)),
        ((1, 9), (2, 9)),
        ((2, 5), (3, 5)),
        ((2, 8), (2, 9)),
        ((2, 8), (3, 8)),
        ((2, 9), (3, 9)),
        ((3, 0), (4, 0)),
        ((3, 3), (4, 3)),
        ((3, 5), (3, 6)),
        ((3, 6), (4, 6)),
        ((4, 0), (5, 0)),
        ((4, 2), (4, 3)),
        ((4, 4), (4, 5)),
        ((4, 6), (5, 6)),
        ((5, 1), (5, 2)),
        ((5, 2), (5, 3)),
        ((5, 3), (6, 3)),
        ((5, 4), (6, 4)),
        ((5, 5), (6, 5)),
        ((5, 6), (5, 7)),
        ((5, 6), (6, 6)),
        ((5, 7), (5, 8)),
        ((5, 9), (6, 9)),
        ((6, 1), (6, 2)),
        ((6, 2), (6, 3)),
        ((6, 4), (6, 5)),
        ((6, 4), (7, 4)),
        ((6, 5), (6, 6)),
        ((6, 5), (7, 5)),
        ((7, 0), (7, 1)),
        ((7, 2), (8, 2)),
        ((7, 5), (7, 6)),
        ((7, 7), (7, 8)),
        ((7, 8), (7, 9)),
        ((8, 7), (9, 7)),
        ((9, 8), (9, 9)),
    })),
}


def get_fixed_maze(size: int) -> PassageMaze:
    """시대 크기로 고정 초기 미로를 조회한다."""
    return _FIXED_MAZES[size]
