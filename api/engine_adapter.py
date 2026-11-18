"""실제 Python 강화학습 엔진(core.simulation.Simulation)과 DEMO 엔진을 통합하는 Adapter 계층.

docs/interface.md 15번 외부 제어 인터페이스(start, pause, resume, step, reset, get_state,
is_finished)만 호출한다.
"""

from __future__ import annotations

from typing import Any

import numpy as np

import config
from api.mock_engine import LocalSimulationStateError, MockSimulationEngine
from api.schemas import BuilderMode, EngineMode, RequestedEngineMode


def to_json_safe(value: Any) -> Any:
    """NumPy 배열·스칼라 및 튜플을 JSON 직렬화 가능한 순수 파이썬 타입으로 변환한다."""
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, dict):
        return {str(k): to_json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_json_safe(item) for item in value]
    return value


def _try_import_real_core() -> tuple[type[Any] | None, type[RuntimeError]]:
    """core.simulation의 Simulation 및 SimulationStateError를 임포트해 반환한다."""
    try:
        import core.simulation as sim_module  # type: ignore[import-not-found]

        sim_cls = getattr(sim_module, "Simulation", None)
        err_cls = getattr(sim_module, "SimulationStateError", LocalSimulationStateError)
        return sim_cls, err_cls
    except (ModuleNotFoundError, ImportError):
        return None, LocalSimulationStateError


def get_simulation_state_error_types() -> tuple[type[BaseException], ...]:
    """실제 코어 및 로컬 모의 엔진의 SimulationStateError 예외 타입 튜플을 반환한다."""
    _, err_cls = _try_import_real_core()
    if err_cls is LocalSimulationStateError:
        return (LocalSimulationStateError,)
    return (err_cls, LocalSimulationStateError)


def is_real_engine_available() -> bool:
    """실제 core.simulation.Simulation 사용 가능 여부를 bool로 반환한다."""
    sim_cls, _ = _try_import_real_core()
    return sim_cls is not None


class SimulationAdapter:
    """실제 Simulation 또는 MockSimulationEngine을 15번 규격으로 감싸는 어댑터."""

    def __init__(
        self,
        builder_mode: BuilderMode = "sarsa",
        seed: int | None = None,
        requested_mode: RequestedEngineMode = "auto",
    ) -> None:
        """builder_mode, seed, 요청 모드(auto/demo/real)를 받아 엔진을 초기화한다."""
        self.era_sizes: list[int] = [int(size) for size in config.ERA_SIZES]
        real_cls, err_cls = _try_import_real_core()
        self.engine_available: bool = real_cls is not None
        self.state_error_cls: type[RuntimeError] = err_cls

        if requested_mode == "real":
            if real_cls is None:
                raise RuntimeError(
                    "Real engine (core.simulation.Simulation) is not available yet. "
                    "Use DEMO mode until core/simulation.py is integrated."
                )
            self._sim = real_cls(builder_mode=builder_mode, seed=seed)
            self.mode: EngineMode = "REAL"
        elif requested_mode == "auto" and real_cls is not None:
            self._sim = real_cls(builder_mode=builder_mode, seed=seed)
            self.mode = "REAL"
        else:
            self._sim = MockSimulationEngine(
                builder_mode=builder_mode,
                seed=seed,
                state_error_cls=err_cls,
            )
            self.mode = "DEMO"

    def get_state(self) -> dict[str, Any]:
        """코어의 get_state() 결과를 JSON 직렬화 가능한 dict로 반환한다."""
        return to_json_safe(self._sim.get_state())

    def start(self) -> dict[str, Any]:
        """코어의 start()를 호출하고 SimulationState dict를 반환한다."""
        return to_json_safe(self._sim.start())

    def pause(self) -> dict[str, Any]:
        """코어의 pause()를 호출하고 SimulationState dict를 반환한다."""
        return to_json_safe(self._sim.pause())

    def resume(self) -> dict[str, Any]:
        """코어의 resume()를 호출하고 SimulationState dict를 반환한다."""
        return to_json_safe(self._sim.resume())

    def step(self) -> dict[str, Any]:
        """코어의 step()을 1회 실행하고 JSON 직렬화 가능한 RoundResult dict를 반환한다."""
        normalized = to_json_safe(self._sim.step())
        if not isinstance(normalized, dict):
            raise ValueError("Simulation.step() must return a dict matching docs/interface.md §15-5")
        return normalized

    def reset(
        self,
        builder_mode: BuilderMode | None = None,
        seed: int | None = None,
    ) -> dict[str, Any]:
        """코어의 reset(builder_mode, seed)을 호출하고 SimulationState dict를 반환한다."""
        return to_json_safe(self._sim.reset(builder_mode=builder_mode, seed=seed))

    def is_finished(self) -> bool:
        """코어의 is_finished() 종료 여부를 bool로 반환한다."""
        return bool(self._sim.is_finished())
