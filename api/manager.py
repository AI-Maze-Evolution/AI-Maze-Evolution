"""시뮬레이션 실행 상태 관리, 스레드 안전 직렬화 실행 및 WebSocket 브로드캐스트 매니저.

docs/interface.md 15-8번 규정에 따라 모든 코어 호출을 단일 asyncio.Lock으로 직렬화하고,
pause/reset 시 진행 중인 to_thread(step) 완료를 안전하게 기다린 뒤 상태를 전환한다.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from api.engine_adapter import (
    SimulationAdapter,
    get_simulation_state_error_types,
    is_real_engine_available,
)
from api.schemas import (
    BuilderMode,
    EditHistoryEntryModel,
    HistoryItemModel,
    RequestedEngineMode,
    RoundResultModel,
    SimulationStateResponse,
)


def _utc_now_iso() -> str:
    """현재 UTC 시각을 ISO 8601 문자열로 반환한다."""
    return datetime.now(timezone.utc).isoformat()


def _compute_era_transitions(history: list[dict[str, Any]]) -> list[int]:
    """코어 history 목록에서 시대가 전환된 라운드 번호 리스트를 계산한다."""
    transitions: list[int] = []
    last_era: int | None = None
    for item in history:
        era = int(item["era"])
        if last_era is not None and era != last_era:
            transitions.append(int(item["round"]))
        last_era = era
    return transitions


class SimulationManager:
    """단일 시뮬레이션 세션의 코어 제어, 비차단 반복 실행, WS 팬아웃을 관리한다."""

    def __init__(self) -> None:
        """초기 어댑터와 단일 코어 잠금, 협력적 루프 중지 신호를 생성한다."""
        self.requested_mode: RequestedEngineMode = "auto"
        self.adapter = SimulationAdapter(builder_mode="sarsa", seed=None, requested_mode=self.requested_mode)
        self.speed: float = 1.5
        self.prev_grid: list[list[int]] | None = None
        self.edit_history: list[dict[str, Any]] = []
        self.error: str | None = None

        self._core_lock = asyncio.Lock()
        self._loop_active = False
        self._stop_event = asyncio.Event()
        self._run_task: asyncio.Task[None] | None = None
        self._connections: set[WebSocket] = set()

    @property
    def active_connections(self) -> int:
        """현재 연결된 WebSocket 클라이언트 수를 반환한다."""
        return len(self._connections)

    def _build_state_response(self, core_state: dict[str, Any]) -> SimulationStateResponse:
        """코어의 SimulationState dict에 API 메타데이터를 결합해 응답 모델을 만든다."""
        raw_history = core_state.get("history") or []
        history_models = [HistoryItemModel.model_validate(item) for item in raw_history]
        last_result_raw = core_state.get("last_result")
        last_result_model = (
            RoundResultModel.model_validate(last_result_raw) if last_result_raw is not None else None
        )

        # 재접속 또는 외부 reset 후 edit_history가 비어 있으면 코어 history에서 기본 항목을 복구한다.
        edit_entries = self.edit_history
        if not edit_entries and raw_history:
            edit_entries = [
                {
                    "round": item["round"],
                    "era": item["era"],
                    "size": item["size"],
                    "edit": None,
                    "edit_type": item.get("edit_type"),
                    "edit_reverted": item["edit_reverted"],
                    "builder_state": None,
                    "builder_action": None,
                    "builder_action_name": item.get("builder_action_name"),
                    "builder_reward": item["builder_reward"],
                    "success_rate": item["success_rate"],
                    "shortest_path_len": None,
                }
                for item in raw_history
            ]

        return SimulationStateResponse(
            status="error" if self.error else core_state["status"],
            builder_mode=core_state["builder_mode"],
            seed=int(core_state["seed"]),
            round=int(core_state["round"]),
            era=int(core_state["era"]),
            size=int(core_state["size"]),
            start=list(core_state["start"]),
            goal=list(core_state["goal"]),
            grid=core_state["grid"],
            finished=bool(core_state["finished"]),
            last_result=last_result_model,
            history=history_models,
            mode=self.adapter.mode,
            engine_available=is_real_engine_available(),
            speed=self.speed,
            era_sizes=self.adapter.era_sizes,
            prev_grid=self.prev_grid,
            edit_history=[EditHistoryEntryModel.model_validate(entry) for entry in edit_entries],
            era_transitions=_compute_era_transitions(raw_history),
            error=self.error,
        )

    async def get_state(self) -> SimulationStateResponse:
        """코어 잠금 하에 get_state()를 조회하고 전체 상태 응답을 반환한다."""
        async with self._core_lock:
            core_state = await asyncio.to_thread(self.adapter.get_state)
            return self._build_state_response(core_state)

    async def connect(self, websocket: WebSocket) -> None:
        """새 WebSocket 연결을 수락하고 코어 기반 최신 상태 스냅샷을 즉시 전송한다."""
        await websocket.accept()
        self._connections.add(websocket)
        state = await self.get_state()
        await websocket.send_json(
            {
                "type": "state_snapshot",
                "timestamp": _utc_now_iso(),
                "data": state.model_dump(),
            }
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """종료된 WebSocket 연결을 활성 목록에서 제거한다."""
        self._connections.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        """연결된 모든 WebSocket 클라이언트에 JSON 메시지를 전송한다."""
        if not self._connections:
            return
        stale: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self._connections.discard(ws)

    async def _broadcast_status(self, state: SimulationStateResponse) -> None:
        """현재 상태 변경 알림을 모든 클라이언트에 브로드캐스트한다."""
        await self.broadcast(
            {
                "type": "status_change",
                "timestamp": _utc_now_iso(),
                "data": {
                    "mode": state.mode,
                    "status": state.status,
                    "builder_mode": state.builder_mode,
                    "seed": state.seed,
                    "speed": state.speed,
                    "round": state.round,
                    "era": state.era,
                    "size": state.size,
                    "finished": state.finished,
                    "error": state.error,
                },
            }
        )

    async def _stop_loop_gracefully(self) -> None:
        """진행 중인 step() 스레드가 끝날 때까지 기다려 루프를 안전하게 정지한다.

        태스크를 강제 cancel()하지 않고 협력적 중지 신호를 보내므로,
        to_thread(step)가 끝날 때까지 잠금이 안전하게 유지된다.
        """
        self._loop_active = False
        self._stop_event.set()
        task = self._run_task
        if task is not None and task is not asyncio.current_task():
            await task
        self._run_task = None

    def _start_loop_task(self) -> None:
        """자동 실행 백그라운드 루프 태스크를 시작한다."""
        self._loop_active = True
        self._stop_event.clear()
        self._run_task = asyncio.create_task(self._run_loop())

    async def _execute_step_locked(self) -> tuple[dict[str, Any], SimulationStateResponse]:
        """단일 _core_lock 내부에서 코어 step()을 1회 실행하고 브로드캐스트한다."""
        before_state = await asyncio.to_thread(self.adapter.get_state)
        before_grid = before_state["grid"]
        before_era = int(before_state["era"])

        raw_result = await asyncio.to_thread(self.adapter.step)
        validated = RoundResultModel.model_validate(raw_result).model_dump()
        after_state = await asyncio.to_thread(self.adapter.get_state)

        # 같은 시대 내 실행이면 직전 미로를 비교용으로 보관
        self.prev_grid = before_grid if before_era == validated["era"] else None

        report_q = validated["reports"]["q"]
        edit = validated["edit"]
        edit_record = {
            "round": validated["round"],
            "era": validated["era"],
            "size": validated["size"],
            "edit": edit,
            "edit_type": edit["type"] if edit is not None else None,
            "edit_reverted": validated["edit_reverted"],
            "builder_state": validated["builder_state"],
            "builder_action": validated["builder_action"],
            "builder_action_name": validated["builder_action_name"],
            "builder_reward": validated["builder_reward"],
            "success_rate": report_q["success_rate"],
            "shortest_path_len": report_q["shortest_path_len"],
        }
        self.edit_history.append(edit_record)
        self.error = None

        response_state = self._build_state_response(after_state)
        history_item = (
            response_state.history[-1].model_dump()
            if response_state.history
            else {
                "round": validated["round"],
                "era": validated["era"],
                "size": validated["size"],
                "success_rate": report_q["success_rate"],
                "early_success_rate": report_q["early_success_rate"],
                "avg_reward": report_q["avg_reward"],
                "avg_steps": report_q["avg_steps"],
                "builder_reward": validated["builder_reward"],
                "builder_action_name": validated["builder_action_name"],
                "edit_type": edit["type"] if edit is not None else None,
                "edit_reverted": validated["edit_reverted"],
                "era_changed": validated["era_changed"],
            }
        )

        await self.broadcast(
            {
                "type": "round_update",
                "timestamp": _utc_now_iso(),
                "data": {
                    "mode": response_state.mode,
                    "status": response_state.status,
                    "result": validated,
                    "next_grid": response_state.grid,
                    "next_era": response_state.era,
                    "next_size": response_state.size,
                    "next_start": response_state.start,
                    "next_goal": response_state.goal,
                    "finished": response_state.finished,
                    "prev_grid": self.prev_grid,
                    "history_item": history_item,
                    "edit_record": edit_record,
                    "era_transitions": response_state.era_transitions,
                },
            }
        )
        return validated, response_state

    async def _run_loop(self) -> None:
        """코어 status가 running인 동안 배속 간격으로 step()을 반복 실행한다."""
        state_errors = get_simulation_state_error_types()
        while self._loop_active:
            try:
                async with self._core_lock:
                    if not self._loop_active:
                        break
                    core_state = await asyncio.to_thread(self.adapter.get_state)
                    if core_state["status"] != "running" or core_state["finished"]:
                        self._loop_active = False
                        break
                    _, next_state = await self._execute_step_locked()
                    if next_state.finished or next_state.status != "running":
                        self._loop_active = False
                        break
            except state_errors:
                self._loop_active = False
                break
            except Exception as exc:
                self._loop_active = False
                self.error = f"{type(exc).__name__}: {exc}"
                await self.broadcast(
                    {
                        "type": "error",
                        "timestamp": _utc_now_iso(),
                        "message": self.error,
                    }
                )
                break

            interval = max(0.05, 1.0 / max(0.25, self.speed))
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=interval)
            except asyncio.TimeoutError:
                continue

    async def start(
        self,
        speed: float | None = None,
        builder_mode: BuilderMode | None = None,
        seed: int | None = None,
    ) -> SimulationStateResponse:
        """코어의 start()를 호출해 자동 실행을 시작하고 최신 상태를 반환한다."""
        if speed is not None:
            self.speed = float(speed)

        async with self._core_lock:
            core_state = await asyncio.to_thread(self.adapter.get_state)
            needs_reconfigure = (
                (builder_mode is not None and builder_mode != core_state["builder_mode"])
                or (seed is not None and int(seed) != int(core_state["seed"]))
            )
            if needs_reconfigure and core_state["status"] == "idle":
                await asyncio.to_thread(self.adapter.reset, builder_mode, seed)
                self.prev_grid = None
                self.edit_history = []

            self.error = None
            next_core = await asyncio.to_thread(self.adapter.start)
            response = self._build_state_response(next_core)
            self._start_loop_task()

        await self._broadcast_status(response)
        return response

    async def pause(self) -> SimulationStateResponse:
        """진행 중인 step() 완료를 기다린 뒤 코어의 pause()를 호출하고 최신 상태를 반환한다."""
        await self._stop_loop_gracefully()
        async with self._core_lock:
            next_core = await asyncio.to_thread(self.adapter.pause)
            response = self._build_state_response(next_core)
        await self._broadcast_status(response)
        return response

    async def resume(self) -> SimulationStateResponse:
        """코어의 resume()을 호출해 자동 실행을 재개하고 최신 상태를 반환한다."""
        async with self._core_lock:
            self.error = None
            next_core = await asyncio.to_thread(self.adapter.resume)
            response = self._build_state_response(next_core)
            self._start_loop_task()
        await self._broadcast_status(response)
        return response

    async def step(self) -> SimulationStateResponse:
        """자동 실행 중이면 안전하게 정지한 뒤 코어 step()을 정확히 1회 실행한다."""
        await self._stop_loop_gracefully()
        async with self._core_lock:
            core_state = await asyncio.to_thread(self.adapter.get_state)
            if core_state["status"] == "running":
                await asyncio.to_thread(self.adapter.pause)
            _, response = await self._execute_step_locked()
        return response

    async def reset(
        self,
        builder_mode: BuilderMode | None = None,
        seed: int | None = None,
        mode: RequestedEngineMode | None = None,
    ) -> SimulationStateResponse:
        """진행 중인 루프를 안전하게 정지한 뒤 코어를 초기화하고 스냅샷을 브로드캐스트한다."""
        await self._stop_loop_gracefully()
        async with self._core_lock:
            current_state = await asyncio.to_thread(self.adapter.get_state)
            target_builder: BuilderMode = builder_mode or current_state["builder_mode"]
            target_seed: int | None = seed if seed is not None else int(current_state["seed"])

            if mode is not None and mode != self.requested_mode:
                self.adapter = SimulationAdapter(
                    builder_mode=target_builder,
                    seed=target_seed,
                    requested_mode=mode,
                )
                self.requested_mode = mode
                next_core = await asyncio.to_thread(self.adapter.get_state)
            else:
                next_core = await asyncio.to_thread(self.adapter.reset, builder_mode, seed)

            self.prev_grid = None
            self.edit_history = []
            self.error = None
            response = self._build_state_response(next_core)

        await self.broadcast(
            {
                "type": "state_snapshot",
                "timestamp": _utc_now_iso(),
                "data": response.model_dump(),
            }
        )
        return response

    async def set_speed(self, speed: float) -> SimulationStateResponse:
        """라운드 실행 배속을 변경하고 최신 상태를 반환한다."""
        self.speed = float(speed)
        state = await self.get_state()
        await self._broadcast_status(state)
        return state

    async def shutdown(self) -> None:
        """서버 종료 시 실행 루프 완료를 대기하고 WebSocket 연결을 정리한다."""
        await self._stop_loop_gracefully()
        for ws in list(self._connections):
            try:
                await ws.close()
            except Exception:
                pass
        self._connections.clear()
