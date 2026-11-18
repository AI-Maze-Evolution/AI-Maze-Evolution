"""UI 규약, 비동기 제어와 headless 진입점을 검증한다."""

import sys
from concurrent.futures import Future
from types import ModuleType
from unittest.mock import Mock

import pytest

matplotlib = pytest.importorskip("matplotlib")
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from main import main
from ui.dashboard import Dashboard, DemoSimulation, make_demo_result


def test_render_all_eras(tmp_path):
    """세 크기의 가짜 결과를 그려 시대 경계와 그래프 누적을 확인한다."""
    dashboard = Dashboard(DemoSimulation(), demo=True)
    try:
        for number in range(1, 37):
            result = make_demo_result(number)
            dashboard.charts.append(result)
            dashboard.latest = result
            dashboard.render()
        dashboard.fig.savefig(tmp_path / "dashboard.png")
        assert dashboard.charts.transitions == [12.5, 24.5]
        assert len(dashboard.charts.history) == 36
        assert len(dashboard.fig.axes) == 11
        assert dashboard.maze_axes[0].images[0].get_array().shape == (10, 10)
    finally:
        dashboard.close()
        plt.close(dashboard.fig)


def test_pause_collects_inflight_without_submitting_next():
    """일시정지 후 진행 중 결과는 수집하되 다음 학습은 요청하지 않는지 확인한다."""
    simulation = DemoSimulation()
    simulation.step_round = Mock(side_effect=simulation.step_round)
    dashboard = Dashboard(simulation)
    try:
        dashboard.running = True
        dashboard.future = Future()
        dashboard.toggle()
        dashboard.future.set_result(make_demo_result())
        dashboard.tick()
        assert len(dashboard.charts.history) == 1
        simulation.step_round.assert_not_called()
        assert dashboard.future is None
    finally:
        dashboard.close()
        plt.close(dashboard.fig)


def test_failure_stops_resubmission():
    """학습 오류가 발생하면 자동 재시도를 중단하는지 확인한다."""
    dashboard = Dashboard(DemoSimulation())
    try:
        dashboard.running = True
        dashboard.future = Future()
        dashboard.future.set_exception(ValueError("bad result"))
        dashboard.tick()
        dashboard.step()
        assert dashboard.failed and not dashboard.running
        assert dashboard.future is None
        assert "bad result" in dashboard.status.get_text()
    finally:
        dashboard.close()
        plt.close(dashboard.fig)


def test_headless_calls_only_run_all(monkeypatch):
    """headless 진입점이 선택한 Builder로 엔진을 만들고 run_all만 호출하는지 확인한다."""
    module = ModuleType("core.simulation")
    module.Simulation = Mock()
    monkeypatch.setitem(sys.modules, "core.simulation", module)
    assert main(["--headless", "--builder-mode", "rule"]) == 0
    module.Simulation.assert_called_once_with(builder_mode="rule")
    module.Simulation.return_value.run_all.assert_called_once_with()


def test_demo_finishes_and_preserves_inputs():
    """데모 종료, 초기화 및 경로 좌표가 규약을 만족하는지 확인한다."""
    sim = DemoSimulation()
    for _ in range(36):
        result = sim.step_round()
        for path in result["best_paths"].values():
            assert path[0] == (0, 0)
            assert path[-1] == (result["size"] - 1,) * 2
            assert all(result["grid"][row][col] == 0 for row, col in path)
    assert sim.is_finished() and result["finished"]
    with pytest.raises(StopIteration):
        sim.step_round()
