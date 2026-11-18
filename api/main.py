"""AI Maze Evolution 웹 프론트엔드 연결용 FastAPI 서버 엔트리포인트.

실행 예시:
    uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.engine_adapter import get_simulation_state_error_types, is_real_engine_available
from api.manager import SimulationManager
from api.schemas import (
    HealthResponse,
    ResetRequest,
    SimulationStateResponse,
    SpeedRequest,
    StartRequest,
)


def create_app() -> FastAPI:
    """FastAPI 애플리케이션 인스턴스를 생성하고 라우트를 등록해 반환한다."""
    manager = SimulationManager()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        yield
        await manager.shutdown()

    app = FastAPI(
        title="AI Maze Evolution API",
        version="0.2.0",
        description="FastAPI + WebSocket bridge aligned with docs/interface.md §15.",
        lifespan=lifespan,
    )
    app.state.manager = manager

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        """서버와 시뮬레이션 엔진 어댑터의 상태를 반환한다."""
        state = await manager.get_state()
        return HealthResponse(
            status="ok",
            mode=state.mode,
            engine_available=is_real_engine_available(),
            simulation_status=state.status,
            active_connections=manager.active_connections,
        )

    @app.get("/api/simulation/state", response_model=SimulationStateResponse)
    async def get_simulation_state() -> SimulationStateResponse:
        """현재 시뮬레이션 전체 상태 스냅샷을 반환한다."""
        return await manager.get_state()

    @app.post("/api/simulation/start", response_model=SimulationStateResponse)
    async def start_simulation(payload: StartRequest | None = None) -> SimulationStateResponse:
        """시뮬레이션 자동 진행을 시작하고 최신 상태를 반환한다."""
        req = payload or StartRequest()
        try:
            return await manager.start(
                speed=req.speed,
                builder_mode=req.builder_mode,
                seed=req.seed,
            )
        except get_simulation_state_error_types() as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/simulation/pause", response_model=SimulationStateResponse)
    async def pause_simulation() -> SimulationStateResponse:
        """실행 중인 시뮬레이션을 일시정지하고 최신 상태를 반환한다."""
        try:
            return await manager.pause()
        except get_simulation_state_error_types() as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/simulation/resume", response_model=SimulationStateResponse)
    async def resume_simulation() -> SimulationStateResponse:
        """일시정지된 시뮬레이션을 재개하고 최신 상태를 반환한다."""
        try:
            return await manager.resume()
        except get_simulation_state_error_types() as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/simulation/step", response_model=SimulationStateResponse)
    async def step_simulation() -> SimulationStateResponse:
        """시뮬레이션을 정확히 1라운드 실행하고 최신 상태를 반환한다."""
        try:
            return await manager.step()
        except get_simulation_state_error_types() as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/simulation/reset", response_model=SimulationStateResponse)
    async def reset_simulation(payload: ResetRequest | None = None) -> SimulationStateResponse:
        """시뮬레이션을 지정한 builder_mode와 seed로 초기화하고 최신 상태를 반환한다."""
        req = payload or ResetRequest()
        try:
            return await manager.reset(
                builder_mode=req.builder_mode,
                seed=req.seed,
                mode=req.mode,
            )
        except get_simulation_state_error_types() as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except (ValueError, RuntimeError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/simulation/speed", response_model=SimulationStateResponse)
    async def update_speed(payload: SpeedRequest) -> SimulationStateResponse:
        """시뮬레이션 자동 실행 배속을 변경하고 최신 상태를 반환한다."""
        return await manager.set_speed(payload.speed)

    @app.websocket("/ws/simulation")
    async def simulation_websocket(websocket: WebSocket) -> None:
        """실시간 시뮬레이션 라운드 업데이트를 전송하는 WebSocket 엔드포인트."""
        await manager.connect(websocket)
        try:
            while True:
                message = await websocket.receive_json()
                if isinstance(message, dict) and message.get("type") == "ping":
                    await websocket.send_json(
                        {
                            "type": "pong",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
        except WebSocketDisconnect:
            manager.disconnect(websocket)
        except Exception:
            manager.disconnect(websocket)

    return app


app = create_app()
