# api/ — FastAPI 및 WebSocket 브리지

## 담당자
- 수암

## 파일별 역할
- `main.py`: FastAPI 애플리케이션 엔트리포인트 (`uvicorn api.main:app --reload --port 8000`). REST 제어 및 `WS /ws/simulation` 제공. `SimulationStateError`는 HTTP `409 Conflict`로 변환
- `schemas.py`: `docs/interface.md` 11번·15번(`RoundResult`, `SimulationState`, `HistoryItem`) 기반 Pydantic 모델
- `engine_adapter.py`: 실제 `core.simulation.Simulation` 또는 `MockSimulationEngine`을 15번 인터페이스로 감싸는 어댑터
- `manager.py`: 단일 `asyncio.Lock`으로 모든 코어 호출 직렬화, `asyncio.to_thread`로 이벤트 루프 비차단 실행, 협력적 루프 종료 및 WebSocket 브로드캐스트
- `mock_engine.py`: `core/simulation.py` 통합 전 독립 검증용 `DEMO` 엔진 (15번 규격 완전 구현, 시대 1부터)
- `requirements.txt`: FastAPI, Uvicorn, Pydantic, httpx 등 API 전용 의존성

## 가져다 쓰는 것
- `core/simulation.py`: `Simulation(builder_mode, seed)`, `SimulationStateError`, `start`, `pause`, `resume`, `step`, `reset`, `get_state`, `is_finished` (`docs/interface.md` 15번)
- `config.py`: `SEED`, `ERA_SIZES`, `WALL_DENSITY`, `ROUND_EPISODES` 등
- 그 외 `core/`, `agents/` 내부 구현은 직접 수정하거나 우회하지 않는다

## 반드시 지킬 것
1. `Simulation`은 스레드 안전하지 않으므로 모든 코어 호출을 단일 `asyncio.Lock`으로 직렬화한다.
2. `pause()` / `reset()` 시 `to_thread(step)` 태스크를 강제 취소하지 않고 진행 중인 라운드 완료를 기다린 뒤 코어 상태를 전환한다.
3. `DEMO` 모드는 실제 학습 결과와 혼동되지 않도록 응답의 `mode: "DEMO"`를 유지한다.
4. `SimulationState.grid`(다음 라운드용 현재 미로)와 `last_result.grid`(방금 실행한 라운드 미로)를 혼동하지 않는다.

## 테스트 (`tests/test_api.py`)
- 상태 전이 및 `SimulationStateError` → HTTP 409 검증
- 동일 `(builder_mode, seed)` 재현성 검증
- 시대 전환 시 `last_result.grid`와 `SimulationState.grid` 분리 검증
- 동시 요청 직렬화 및 WebSocket 재접속 복구 검증
