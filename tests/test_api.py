"""FastAPI 백엔드, WebSocket, 15번 규격 MockSimulationEngine 및 Real Adapter 검증."""

from __future__ import annotations

import asyncio
import sys
import threading
import time
from types import ModuleType

import numpy as np
import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from api.engine_adapter import SimulationAdapter
from api.main import create_app
from api.manager import SimulationManager
from api.mock_engine import MockSimulationEngine

REQUIRED_ROUND_RESULT_KEYS = {
    "round",
    "era",
    "size",
    "start",
    "goal",
    "grid",
    "edit",
    "edit_reverted",
    "reports",
    "best_paths",
    "q_values_max",
    "builder_mode",
    "builder_state",
    "builder_action",
    "builder_action_name",
    "builder_reward",
    "builder_q_table",
    "era_changed",
    "next_size",
    "finished",
}


def test_health_and_initial_state_section15():
    """초기 상태가 15번 규격(era=1, builder_mode=sarsa, start/goal, DEMO)을 따르는지 확인한다."""
    app = create_app()
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        body = health.json()
        assert body["status"] == "ok"
        assert body["mode"] == "DEMO"
        assert body["simulation_status"] == "idle"

        state = client.get("/api/simulation/state")
        assert state.status_code == 200
        data = state.json()
        assert data["status"] == "idle"
        assert data["builder_mode"] == "sarsa"
        assert data["era"] == 1
        assert data["round"] == 0
        assert data["size"] == 5
        assert data["start"] == [0, 0]
        assert data["goal"] == [4, 4]
        assert data["finished"] is False
        assert data["last_result"] is None
        assert data["history"] == []


def test_state_transition_errors_return_409():
    """허용되지 않는 상태 전이 호출 시 SimulationStateError가 HTTP 409로 변환되는지 확인한다."""
    app = create_app()
    with TestClient(app) as client:
        assert client.post("/api/simulation/pause").status_code == 409
        assert client.post("/api/simulation/resume").status_code == 409

        start_resp = client.post("/api/simulation/start", json={"speed": 1.0})
        assert start_resp.status_code == 200
        assert start_resp.json()["status"] == "running"

        # running 상태에서 start 재호출은 409
        assert client.post("/api/simulation/start").status_code == 409

        pause_resp = client.post("/api/simulation/pause")
        assert pause_resp.status_code == 200
        assert pause_resp.json()["status"] == "paused"

        # paused 상태에서 pause 재호출은 409
        assert client.post("/api/simulation/pause").status_code == 409

        resume_resp = client.post("/api/simulation/resume")
        assert resume_resp.status_code == 200
        assert resume_resp.json()["status"] == "running"

        client.post("/api/simulation/reset")


def test_seed_reproducibility_and_rule_mode_q_table():
    """동일한 builder_mode와 seed로 reset 시 동일한 결과가 재현되고 rule 모드 Q-table이 null인지 확인한다."""
    app = create_app()
    with TestClient(app) as client:
        r1 = client.post("/api/simulation/reset", json={"builder_mode": "sarsa", "seed": 777})
        assert r1.status_code == 200
        assert r1.json()["seed"] == 777
        s1_a = client.post("/api/simulation/step").json()
        s2_a = client.post("/api/simulation/step").json()

        r2 = client.post("/api/simulation/reset", json={"builder_mode": "sarsa", "seed": 777})
        assert r2.status_code == 200
        s1_b = client.post("/api/simulation/step").json()
        s2_b = client.post("/api/simulation/step").json()

        assert s1_a["last_result"] == s1_b["last_result"]
        assert s2_a["last_result"] == s2_b["last_result"]
        q_table = s2_a["last_result"]["builder_q_table"]
        assert q_table is not None
        assert len(q_table) == 3 and len(q_table[0]) == 3 and len(q_table[0][0]) == 4
        assert list(s2_a["last_result"]["reports"].keys()) == ["q"]
        assert list(s2_a["last_result"]["best_paths"].keys()) == ["q"]
        assert list(s2_a["last_result"]["q_values_max"].keys()) == ["q"]

        # rule 모드는 builder_q_table == None
        rule_reset = client.post("/api/simulation/reset", json={"builder_mode": "rule", "seed": 777})
        assert rule_reset.status_code == 200
        rule_step = client.post("/api/simulation/step").json()
        assert rule_step["last_result"]["builder_mode"] == "rule"
        assert rule_step["last_result"]["builder_q_table"] is None


def test_mock_engine_era_transition_and_grid_separation():
    """시대 전환 시 1→2→3(5×5→7×7→10×10) 진행과 last_result.grid vs state.grid 분리를 확인한다."""
    engine = MockSimulationEngine(builder_mode="sarsa", seed=42)
    seen_eras: list[int] = []
    seen_sizes: list[int] = []
    verified_transition_separation = False

    while not engine.is_finished():
        result = engine.step()
        assert REQUIRED_ROUND_RESULT_KEYS.issubset(result.keys())
        era = result["era"]
        size = result["size"]
        if not seen_eras or seen_eras[-1] != era:
            seen_eras.append(era)
        if not seen_sizes or seen_sizes[-1] != size:
            seen_sizes.append(size)

        if result["era_changed"]:
            state = engine.get_state()
            assert result["next_size"] == state["size"]
            assert len(result["grid"]) == size
            assert len(state["grid"]) == result["next_size"]
            assert state["era"] == era + 1
            verified_transition_separation = True

        path_q = result["best_paths"]["q"]
        assert path_q[0] == result["start"]
        assert path_q[-1] == result["goal"]
        for r, c in path_q:
            assert result["grid"][r][c] == 0

    assert seen_eras == [1, 2, 3]
    assert seen_sizes == [5, 7, 10]
    assert verified_transition_separation
    assert engine.get_state()["status"] == "finished"

    # finished 상태에서 step 호출 시 SimulationStateError 발생
    with pytest.raises(RuntimeError):
        engine.step()


def test_websocket_snapshot_reconnect_and_round_update():
    """WebSocket 스냅샷, ping/pong, round_update 및 재접속 시 history/last_result 복구를 확인한다."""
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws/simulation") as ws:
            snapshot = ws.receive_json()
            assert snapshot["type"] == "state_snapshot"
            assert snapshot["data"]["era"] == 1
            assert snapshot["data"]["mode"] == "DEMO"

            ws.send_json({"type": "ping"})
            assert ws.receive_json()["type"] == "pong"

            step_resp = client.post("/api/simulation/step")
            assert step_resp.status_code == 200

            update = ws.receive_json()
            assert update["type"] == "round_update"
            assert update["data"]["result"]["round"] == 1
            assert update["data"]["history_item"]["round"] == 1

        # 재접속 시 코어 history와 last_result가 그대로 복구되는지 검증
        with client.websocket_connect("/ws/simulation") as ws2:
            snap2 = ws2.receive_json()
            assert snap2["type"] == "state_snapshot"
            assert snap2["data"]["round"] == 1
            assert len(snap2["data"]["history"]) == 1
            assert snap2["data"]["last_result"]["round"] == 1


def test_concurrent_calls_are_serialized():
    """진행 중인 to_thread(step)과 pause/step 요청이 겹쳐도 코어 호출이 직렬화되는지 확인한다."""

    async def scenario():
        manager = SimulationManager()
        active_calls = 0
        max_concurrent = 0
        counter_lock = threading.Lock()
        orig_step = manager.adapter.step

        def slow_step():
            nonlocal active_calls, max_concurrent
            with counter_lock:
                active_calls += 1
                max_concurrent = max(max_concurrent, active_calls)
            time.sleep(0.08)
            try:
                return orig_step()
            finally:
                with counter_lock:
                    active_calls -= 1

        manager.adapter.step = slow_step  # type: ignore[method-assign]

        await manager.start(speed=20.0)
        await asyncio.sleep(0.03)
        # 실행 중인 step()과 동시에 pause() 및 수동 step() 호출
        paused_state = await manager.pause()
        assert paused_state.status == "paused"
        stepped_state = await manager.step()
        assert stepped_state.round >= paused_state.round + 1
        assert max_concurrent == 1
        await manager.shutdown()

    asyncio.run(scenario())


def test_requesting_real_mode_without_core_returns_400():
    """core.simulation이 없을 때 real 모드 요청 시 400 오류를 반환하는지 확인한다."""
    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/api/simulation/reset", json={"mode": "real"})
        assert resp.status_code == 400
        assert "core.simulation.Simulation" in resp.json()["detail"]


def test_real_simulation_adapter_section15(monkeypatch):
    """실제 core.simulation.Simulation(15번 규격) 연결 시 제어 메서드와 직렬화가 동작하는지 확인한다."""

    class FakeSimulationStateError(RuntimeError):
        pass

    class FakeRealSimulation:
        def __init__(self, builder_mode="sarsa", seed=None):
            self.builder_mode = builder_mode
            self.seed = 42 if seed is None else seed
            self.status = "idle"
            self.round = 0
            self.era = 1
            self.size = 5
            self.grid = np.zeros((5, 5), dtype=int)
            self.last_result = None
            self.history = []

        def is_finished(self):
            return self.status == "finished"

        def get_state(self):
            return {
                "status": self.status,
                "builder_mode": self.builder_mode,
                "seed": self.seed,
                "round": self.round,
                "era": self.era,
                "size": self.size,
                "start": [0, 0],
                "goal": [4, 4],
                "grid": self.grid,
                "finished": self.is_finished(),
                "last_result": self.last_result,
                "history": self.history,
            }

        def start(self):
            if self.status != "idle":
                raise FakeSimulationStateError("not idle")
            self.status = "running"
            return self.get_state()

        def pause(self):
            if self.status != "running":
                raise FakeSimulationStateError("not running")
            self.status = "paused"
            return self.get_state()

        def resume(self):
            if self.status != "paused":
                raise FakeSimulationStateError("not paused")
            self.status = "running"
            return self.get_state()

        def reset(self, builder_mode=None, seed=None):
            if builder_mode is not None:
                self.builder_mode = builder_mode
            if seed is not None:
                self.seed = seed
            self.status = "idle"
            self.round = 0
            self.last_result = None
            self.history = []
            return self.get_state()

        def step(self):
            if self.status == "finished":
                raise FakeSimulationStateError("finished")
            self.round += 1
            self.status = "finished"
            res = {
                "round": np.int64(self.round),
                "era": 1,
                "size": 5,
                "start": (0, 0),
                "goal": (4, 4),
                "grid": self.grid,
                "edit": {"type": "add_wall", "pos": (1, 2)},
                "edit_reverted": np.bool_(False),
                "reports": {
                    "q": {
                        "algo": "q",
                        "n_episodes": 50,
                        "success_rate": np.float64(0.8),
                        "early_success_rate": np.float64(0.6),
                        "trap_rate": 0.0,
                        "avg_steps": np.float64(10.5),
                        "avg_reward": np.float64(65.0),
                        "visit_counts": np.ones((5, 5), dtype=np.int64),
                        "shortest_path_len": None,
                    }
                },
                "best_paths": {"q": [(0, 0), (0, 1), (4, 4)]},
                "q_values_max": {"q": np.zeros((5, 5), dtype=np.float64)},
                "builder_mode": self.builder_mode,
                "builder_state": (1, 0),
                "builder_action": np.int64(1),
                "builder_action_name": "block_path",
                "builder_reward": np.float64(1.0),
                "builder_q_table": np.zeros((3, 3, 4), dtype=np.float64),
                "era_changed": False,
                "next_size": None,
                "finished": True,
            }
            self.last_result = res
            self.history.append(
                {
                    "round": 1,
                    "era": 1,
                    "size": 5,
                    "success_rate": 0.8,
                    "early_success_rate": 0.6,
                    "avg_reward": 65.0,
                    "avg_steps": 10.5,
                    "builder_reward": 1.0,
                    "builder_action_name": "block_path",
                    "edit_type": "add_wall",
                    "edit_reverted": False,
                    "era_changed": False,
                }
            )
            return res

    fake_module = ModuleType("core.simulation")
    fake_module.Simulation = FakeRealSimulation
    fake_module.SimulationStateError = FakeSimulationStateError
    monkeypatch.setitem(sys.modules, "core.simulation", fake_module)

    adapter = SimulationAdapter(builder_mode="sarsa", seed=99, requested_mode="auto")
    assert adapter.mode == "REAL"
    assert adapter.start()["status"] == "running"
    assert adapter.pause()["status"] == "paused"
    assert adapter.resume()["status"] == "running"
    result = adapter.step()
    assert result["round"] == 1
    assert result["reports"]["q"]["shortest_path_len"] is None
    assert result["builder_action_name"] == "block_path"
    assert isinstance(result["builder_q_table"], list)
    assert adapter.is_finished() is True
    with pytest.raises(FakeSimulationStateError):
        adapter.step()
