"""가짜 에이전트로 라운드, 로그, 시대 전환을 검증한다."""

import json

import numpy as np
import pytest

from core import evolution, simulation
from core.maze import EMPTY, WALL


class FakeBuilder:
    """모든 라운드에서 같은 벽 수정을 제안한다."""

    last_state = np.int64(1)
    last_action = 0

    def propose_edit(self, grid, start, goal, report):
        """환경과 직전 성적표를 받아 고정된 수정안을 반환한다."""
        return {"type": "add_wall", "pos": (1, 1)}



class FakeSolver:
    """로그에 사용할 Q 테이블과 고정 경로를 제공한다."""

    def reset_for_size(self, size):
        """미로 크기에 맞게 Q 테이블을 초기화한다."""
        self.q_table = np.zeros((size, size, 4))

    def greedy_path(self, env):
        """환경을 받아 시작점 한 칸으로 구성된 경로를 반환한다."""
        return [env.start]


def _install_fakes(monkeypatch, tmp_path, success_rate):
    """임시 로그 위치와 성공률을 받아 가짜 에이전트 및 격자를 설치한다."""
    calls = []
    learned = []

    def make_agents(mode, size, seed):
        """제작 방식과 크기를 받아 테스트용 에이전트와 실행기를 반환한다."""
        builder, solver = FakeBuilder(), FakeSolver()
        if mode == "sarsa":
            builder.q_table = np.arange(36).reshape(3, 3, 4)
        solver.reset_for_size(size)
        return builder, solver, run_round, ("block_hot", "block_path", "random_wall", "remove_wall")

    def run_round(env, agent, episodes):
        """환경과 Solver 및 판 수를 받아 일정한 성적표를 반환한다."""
        calls.append((env, episodes))
        return {
            "algo": "q", "n_episodes": episodes, "success_rate": success_rate,
            "early_success_rate": success_rate, "trap_rate": 0.0, "avg_steps": 2.0,
            "avg_reward": 1.0, "visit_counts": np.ones_like(env.grid),
            "shortest_path_len": 2 * (env.size - 1),
        }

    def open_maze(size, rng):
        """요청한 크기의 빈 테스트 격자를 반환한다."""
        return np.zeros((size, size), dtype=int)

    def learn(builder, prev_report, next_report, edit_reverted):
        """Builder에 전달된 이전·현재 성적표와 되돌림 여부를 기록한다."""
        learned.append((prev_report, next_report, edit_reverted))
        return -1 if edit_reverted else 1

    monkeypatch.setattr(FakeBuilder, "learn", learn, raising=False)
    monkeypatch.setattr(simulation, "_make_agents", make_agents)
    monkeypatch.setattr(simulation, "generate_maze", open_maze)
    monkeypatch.setattr(simulation.config, "LOG_DIR", tmp_path)
    return calls, learned


def test_round_results_and_log(monkeypatch, tmp_path):
    """세 라운드의 단일 Solver 실행, Builder 입력, 로그 내용을 검증한다."""
    calls, learned = _install_fakes(monkeypatch, tmp_path, 0.0)
    sim = simulation.Simulation()
    results = [sim.step() for _ in range(3)]
    result = results[-1]
    assert set(result) == {
        "round", "era", "size", "start", "goal", "grid", "edit", "edit_reverted", "reports",
        "best_paths", "q_values_max", "builder_mode", "builder_state", "builder_action", "builder_action_name", "builder_reward",
        "builder_q_table",
        "era_changed", "next_size", "finished",
    }
    assert result["round"] == 3
    assert result["builder_action_name"] == "block_hot"
    assert result["next_size"] is None
    assert result["start"] == [0, 0]
    assert result["goal"] == [result["size"] - 1] * 2
    assert result["edit_reverted"] is True
    assert result["grid"][1][1] == WALL
    assert sim.grid[1, 1] == EMPTY
    for key in ("reports", "best_paths", "q_values_max"):
        assert set(result[key]) == {"q"}
    assert result["builder_q_table"] == np.arange(36).reshape(3, 3, 4).tolist()
    assert result["reports"]["q"]["visit_counts"][0][0] == 1
    assert len(calls) == len(learned) == 3
    for env, episodes in calls:
        assert env.grid[1, 1] == WALL
        assert episodes == simulation.config.ROUND_EPISODES
    assert learned[0][0] is None
    assert learned[1][0] is learned[0][1]
    assert all(entry[2] for entry in learned)
    log_file, = tmp_path.glob("run_*.jsonl")
    assert [json.loads(line) for line in log_file.read_text().splitlines()] == results


def test_era_transition_and_finish(monkeypatch, tmp_path):
    """최소 라운드와 성공률을 만족하면 시대가 바뀌고 마지막 시대에서 끝나는지 검증한다."""
    _install_fakes(monkeypatch, tmp_path, 1.0)
    monkeypatch.setattr(evolution.config, "ERA_MIN_ROUNDS", 1)
    monkeypatch.setattr(evolution.config, "ERA_WINDOW", 1)
    sim = simulation.Simulation("rule")
    result = sim.step_round()
    assert result["size"] == evolution.config.ERA_SIZES[0]
    assert result["era_changed"] is True
    assert result["builder_q_table"] is None
    assert sim.size == evolution.config.ERA_SIZES[1]
    assert result["next_size"] == sim.size
    assert sim.get_state()["last_result"]["size"] == result["size"]
    assert len(sim.get_state()["grid"]) == sim.size
    assert sim.is_finished() is False
    assert sim.run_all() is None
    assert sim.is_finished() is True
    assert sim.get_state()["status"] == "finished"
    with pytest.raises(simulation.SimulationStateError):
        sim.step()
    assert sim.round == len(evolution.config.ERA_SIZES)


def test_era_threshold_and_maximum():
    """최근 성공률 기준과 최대 라운드의 강제 전환을 검증한다."""
    cfg = evolution.config
    history = [0.0] + [cfg.ERA_SUCCESS_THRESHOLD] * cfg.ERA_WINDOW
    assert not evolution.should_advance_era(history, cfg.ERA_MIN_ROUNDS - 1)
    assert evolution.should_advance_era(history, cfg.ERA_MIN_ROUNDS)
    assert evolution.should_advance_era([], cfg.ERA_MAX_ROUNDS)
    assert evolution.next_size(cfg.ERA_SIZES[-1]) is None


def test_external_controls_and_state_history(monkeypatch, tmp_path):
    """외부 제어 상태, 수동 진행, JSON 직렬화와 기록 사본을 검증한다."""
    _install_fakes(monkeypatch, tmp_path, 1.0)
    sim = simulation.Simulation(seed=7)
    initial = sim.get_state()
    assert set(initial) == {
        "status", "builder_mode", "seed", "round", "era", "size", "start", "goal",
        "grid", "finished", "last_result", "history",
    }
    assert initial["status"] == "idle"
    assert initial["seed"] == 7
    assert initial["last_result"] is None
    assert json.loads(json.dumps(initial)) == initial
    with pytest.raises(simulation.SimulationStateError):
        sim.pause()
    sim.step()
    assert sim.status == "idle"
    assert sim.start()["status"] == "running"
    with pytest.raises(simulation.SimulationStateError):
        sim.start()
    assert sim.pause()["status"] == "paused"
    result = sim.step()
    assert sim.status == "paused"
    assert json.loads(json.dumps(result)) == result
    state = sim.resume()
    assert state["status"] == "running"
    assert state["round"] == 2
    assert state["last_result"] == result
    summary = state["history"][-1]
    assert summary == {
        "round": 2, "era": 1, "size": sim.size, "success_rate": 1.0,
        "early_success_rate": 1.0, "avg_reward": 1.0, "avg_steps": 2.0,
        "builder_reward": 1.0, "builder_action_name": "block_hot", "edit_type": "add_wall",
        "edit_reverted": False, "era_changed": False,
    }
    state["history"].clear()
    result["grid"].clear()
    assert len(sim.get_state()["history"]) == 2
    assert sim.get_state()["last_result"]["grid"]


def test_reset_preserves_seed_and_restarts_training(monkeypatch, tmp_path):
    """재설정이 에이전트와 기록을 초기화하고 같은 시드를 재사용하는지 검증한다."""
    generate_maze = simulation.generate_maze
    _install_fakes(monkeypatch, tmp_path, 0.0)
    monkeypatch.setattr(simulation, "generate_maze", generate_maze)
    sim = simulation.Simulation("sarsa", seed=42)
    initial = sim.get_state()
    previous_builder = sim._builder
    first = sim.step()
    assert sim.reset() == initial
    assert sim._builder is not previous_builder
    assert sim.step() == first
    assert len(list(tmp_path.glob("run_*.jsonl"))) == 2
    changed = sim.reset(builder_mode="rule", seed=0)
    assert changed["builder_mode"] == "rule"
    assert changed["seed"] == 0
    assert changed["round"] == 0
    assert changed["history"] == []
    assert sim.step()["builder_q_table"] is None
