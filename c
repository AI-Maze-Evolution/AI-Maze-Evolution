ore/evolution.py"""라운드 성적에 따라 미로 시대의 전환을 판정한다."""

from statistics import mean
from types import SimpleNamespace

try:
    import config
except ModuleNotFoundError as error:
    if error.name != "config":
        raise
    config = SimpleNamespace(
        ERA_SIZES=(5, 7, 10), ERA_MIN_ROUNDS=10, ERA_MAX_ROUNDS=40,
        ERA_WINDOW=5, ERA_SUCCESS_THRESHOLD=0.7,
    )


def should_advance_era(history, rounds_in_era):
    """현재 시대의 성공률과 라운드 수를 받아 전환 여부를 반환한다."""
    if rounds_in_era >= config.ERA_MAX_ROUNDS:
        return True
    window = config.ERA_WINDOW
    return (
        rounds_in_era >= config.ERA_MIN_ROUNDS
        and len(history) >= window
        and mean(history[-window:]) >= config.ERA_SUCCESS_THRESHOLD
    )


def next_size(size):
    """현재 미로 크기를 받아 다음 크기 또는 마지막 시대이면 None을 반환한다."""
    sizes = config.ERA_SIZES
    index = sizes.index(size) + 1
    return sizes[index] if index < len(sizes) else None
