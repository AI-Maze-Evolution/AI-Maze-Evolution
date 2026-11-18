# Frontend–Backend API Contract (`docs/interface.md` §15 기준)

이 문서는 웹 프론트엔드(`frontend/`)와 FastAPI 브리지(`api/`) 간의 REST·WebSocket 통신 규격 및
[`docs/interface.md`](./interface.md) 15번(코어 외부 제어 인터페이스)과의 매핑을 정의한다.

---

## 1. 코어 ↔ API 매핑 (`api/engine_adapter.py`, `api/manager.py`)

`api/engine_adapter.py`는 `docs/interface.md` 15번에 정의된 공개 인터페이스만 호출한다.

- **생성**: `Simulation(builder_mode="sarsa" | "rule", seed: int | None = None)`
- **제어 메서드**: `start()`, `pause()`, `resume()`, `step()`, `reset(builder_mode, seed)`, `get_state()`, `is_finished()`
- **예외 변환**: 허용되지 않는 상태 전이에서 발생하는 `SimulationStateError`는 FastAPI에서 **HTTP `409 Conflict`** 로 반환한다.
- **동시성 보장 (15-8번)**:
  - `SimulationManager`의 모든 코어 호출은 단일 `asyncio.Lock`으로 직렬화한다.
  - `step()`은 이벤트 루프를 막지 않도록 `asyncio.to_thread()`에서 실행한다.
  - `pause()` / `reset()` 시 실행 루프에 협력적 중지 신호(`_stop_event`)를 보내고, 진행 중인 `to_thread(step)`가 완전히 끝난 뒤에 코어의 `pause()` / `reset()`을 호출한다.
- **DEMO 폴백**: `core/simulation.py`가 아직 병합되지 않았거나 `mode="demo"`로 요청한 경우 `MockSimulationEngine`이 동일한 15번 인터페이스로 동작하며 응답에 `"mode": "DEMO"`를 명시한다.

---

## 2. REST API 명세 (`api/main.py`)

| Method & Path | 요청 바디 | 응답 / 오류 |
|---|---|---|
| `GET /api/health` | 없음 | `200` `HealthResponse` (`mode`, `engine_available`, `simulation_status`, `active_connections`) |
| `GET /api/simulation/state` | 없음 | `200` `SimulationStateResponse` (코어 `get_state()` + API 메타데이터) |
| `POST /api/simulation/start` | `{"speed"?: float, "builder_mode"?: "sarsa"\|"rule", "seed"?: int}` | `200` `SimulationStateResponse` / `409` 상태 오류 |
| `POST /api/simulation/pause` | 없음 | `200` `SimulationStateResponse` / `409` 상태 오류 |
| `POST /api/simulation/resume` | 없음 | `200` `SimulationStateResponse` / `409` 상태 오류 |
| `POST /api/simulation/step` | 없음 | `200` `SimulationStateResponse` / `409` 상태 오류 |
| `POST /api/simulation/reset` | `{"builder_mode"?: "sarsa"\|"rule", "seed"?: int, "mode"?: "auto"\|"demo"\|"real"}` | `200` `SimulationStateResponse` / `400` |
| `POST /api/simulation/speed` | `{"speed": float (0.25~20.0)}` | `200` `SimulationStateResponse` |

---

## 3. 데이터 구조 매핑 (`docs/interface.md` 15-5, 15-6)

### `SimulationStateResponse`
코어의 `SimulationState` 필드를 그대로 포함한다:
- `status`: `"idle" | "running" | "paused" | "finished" | "error"`
- `builder_mode`: `"sarsa" | "rule"`
- `seed`: `int`
- `round`: `int` (완료된 라운드 수, 0부터)
- `era`: `int` (현재 시대, **1부터**)
- `size`: `int`, `start`: `[int, int]`, `goal`: `[int, int]`
- `grid`: **다음 라운드에 사용될 현재 미로** (`list[list[int]]`)
- `finished`: `bool`
- `last_result`: 마지막 `step()` 결과 (`RoundResult | null`)
- `history`: 코어가 보관하는 `HistoryItem[]` (재접속 시 차트 즉시 복구)

부가 API 메타데이터:
- `mode`: `"DEMO" | "REAL"`, `engine_available`: `bool`, `speed`: `float`, `era_sizes`: `int[]`
- `prev_grid`: 같은 시대 직전 미로(전후 비교용), `edit_history`, `era_transitions`, `error`

### `RoundResult` (`last_result` 및 `round_update.data.result`)
- 단일 탈출 AI(Q-Learning): `reports.q`, `best_paths.q`, `q_values_max.q` (`shortest_path_len: int | null`)
- 제작 AI(SARSA / Rule): `builder_mode`, `builder_state`, `builder_action`, `builder_action_name` (`"block_hot" | "block_path" | "random_wall" | "remove_wall" | null`), `builder_reward`, `builder_q_table` (`3×3×4` 또는 `rule` 모드 시 `null`)
- 시대 전환: `era_changed`, `next_size`, `finished`

> **주의 (미로 격자 구분)**: 프론트엔드는 `best_paths.q`, `q_values_max.q`, `reports.q.visit_counts`, `edit`를 반드시 `last_result.grid` 위에 겹쳐 렌더링하며, `SimulationState.grid`는 다음 라운드용 현재 미로로 구분해 사용한다.

---

## 4. WebSocket 이벤트 (`WS /ws/simulation`)

- 연결 직후 `state_snapshot`으로 코어 `get_state()` 기반 전체 상태(`history`, `last_result` 포함)를 즉시 전송하여 새로고침·재접속 시 차트와 화면을 복구한다.
- 라운드 실행 시 `round_update` (`result`, `next_grid`, `next_era`, `next_size`, `next_start`, `next_goal`, `prev_grid`, `history_item`, `edit_record`, `era_transitions`)를 브로드캐스트한다.
- 상태/속도 전환 시 `status_change`, 예외 발생 시 `error`, 클라이언트 `{"type": "ping"}` 수신 시 `{"type": "pong"}`을 반환한다.
