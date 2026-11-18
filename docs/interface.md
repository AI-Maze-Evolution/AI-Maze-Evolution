# 인터페이스 약속

이 문서가 모듈 간 약속의 유일한 기준이다. 변경은 팀 합의 후에만 한다.
"(예약)"이 붙은 항목은 함정 확장용으로 자리만 만들어 두고 지금은 동작하지 않는다.

---

## 1. 폴더 구조

    maze_evolution/
    ├── AGENTS.md / CLAUDE.md
    ├── config.py                   공동
    ├── main.py — 수암 (API 구조에 맞춰 위치·역할 결정 예정)
    ├── docs/interface.md           공동
    ├── core/                       윤중
    │   ├── AGENTS.md
    │   ├── maze.py                 미로 표현, BFS, 미로 생성·수정
    │   ├── environment.py          MazeEnv
    │   ├── evolution.py            시대 전환
    │   └── simulation.py           Simulation, 로그
    ├── agents/
    │   ├── AGENTS.md
    │   ├── builder.py              민규
    │   └── solver.py               규민
    ├── api/                        수암 (FastAPI·WebSocket)
    ├── frontend/                   수암 (React)
    ├── ui/                         (사용 안 함 — api/, frontend/로 대체)
    │   ├── AGENTS.md
    │   ├── dashboard.py
    │   ├── maze_view.py
    │   └── charts.py
    ├── tests/
    └── logs/                       git에 올리지 않음

## 의존 방향 (거꾸로 import 금지)

    frontend  →  api  →  core/simulation.py  →  agents/  →  core/maze.py, core/environment.py

- agents/는 api/를 import하지 않는다
- core/는 api/를 import하지 않는다
- api/는 core/simulation.py와 config.py만 import한다

---

## 2. 미로 표현 (core/maze.py)

- 미로(grid): NumPy 2차원 int 배열, 크기 n×n
  - EMPTY = 0 (길)
  - WALL = 1 (벽)
  - TRAP = 2 (예약 — 지금은 미로에 등장하지 않음)
- 시작점: (0, 0) 고정 / 출구: (n-1, n-1) 고정
- 좌표는 항상 (행, 열) 튜플
- 시작점과 출구 칸은 항상 EMPTY이며 어떤 수정으로도 바꿀 수 없다

## 3. 행동 번호 (Solver)

| 번호 | 방향 | 좌표 변화 |
|---|---|---|
| 0 | 상 | (-1, 0) |
| 1 | 하 | (+1, 0) |
| 2 | 좌 | (0, -1) |
| 3 | 우 | (0, +1) |

---

## 4. 미로 도구 (core/maze.py) — 윤중

- is_solvable(grid, start, goal) → bool
- shortest_path(grid, start, goal) → list[(행, 열)] 또는 None  (시작점·출구 포함)
- shortest_path_len(grid, start, goal) → int 또는 None  (걸음 수)
- BFS는 WALL과 TRAP을 모두 지나갈 수 없는 칸으로 본다
  (함정 확장 시에도 수정 불필요)
- generate_maze(size, rng) → grid
  - 벽 비율 config.WALL_DENSITY[size]로 무작위 생성, 풀 수 있을 때까지 재생성
- apply_edit(grid, edit) → new_grid
  - 원본은 바꾸지 않고 복사본을 돌려준다
  - 시작점·출구를 바꾸려 하면 ValueError
  - config.ENABLE_TRAPS가 False인데 함정 관련 edit가 오면 ValueError
- edit 형식:
  {"type": "add_wall" | "remove_wall", "pos": (행, 열)}
  (예약) "add_trap" | "remove_trap"

## 5. 미로 환경 (core/environment.py) — 윤중

    MazeEnv(grid, start, goal, max_steps)

- reset() → state
  - 위치를 start로, 걸음 수를 0으로 초기화. state는 (행, 열) 튜플
- step(action) → (next_state, reward, done, info)
  - 반환 순서 고정
  - 벽이나 미로 밖으로 이동하면 제자리에 머물고 REWARD_WALL_BUMP
  - 길로 이동하면 REWARD_STEP
  - 출구에 들어가면 REWARD_GOAL, done=True
  - 걸음 수가 max_steps에 도달하면 그 걸음 보상에 REWARD_TIMEOUT을 더하고 done=True
  - (예약) 함정 칸에 들어가면 REWARD_TRAP, done=True
  - info = {"result": "goal" | "timeout" | "trap"(예약) | None, "hit_wall": bool, "steps": int}
- set_grid(grid) → None  (미로 교체, 크기는 바뀌지 않음)
- 속성: env.grid, env.size, env.start, env.goal, env.max_steps
- max_steps = config.MAX_STEPS_FACTOR × n × n

## 6. 시대 전환 (core/evolution.py) — 윤중

- should_advance_era(history, rounds_in_era) → bool
  - history: 현재 시대의 라운드별 성공률 리스트
  - rounds_in_era ≥ ERA_MIN_ROUNDS 이고 최근 ERA_WINDOW 라운드 평균 ≥ ERA_SUCCESS_THRESHOLD 이면 True
  - rounds_in_era ≥ ERA_MAX_ROUNDS 이면 무조건 True
- next_size(size) → int 또는 None  (ERA_SIZES의 다음 크기, 마지막이면 None)

---

## 7. 탈출 AI (agents/solver.py) — 규민

QLearningAgent(size, rng):

- select_action(state, greedy=False) → int
  - greedy=False면 ε-greedy, True면 Q값 최대 행동
- update(state, action, reward, next_state, done) → None
  - 다음 상태의 최대 Q값을 사용한다 (Q-Learning)
- decay_epsilon() → None  (한 판 끝날 때마다 호출)
- reset_for_size(size) → None  (시대가 바뀌면 Q-table을 새 크기로 초기화)
- greedy_path(env) → list[(행, 열)]  (탐험 없이 움직인 경로, 최대 env.max_steps 걸음)
- 속성: agent.q_table (size × size × 4), agent.epsilon, agent.name ("q")

run_round(env, agent, n_episodes) → report

## 8. 성적표 (report)

    {
      "algo": "q",
      "n_episodes": int,
      "success_rate": float (0~1),
      "early_success_rate": float (0~1),   이번 라운드 처음 ROUND_EARLY_EPISODES판의 성공률
      "trap_rate": float (0~1),            (예약) 지금은 항상 0.0
      "avg_steps": float,
      "avg_reward": float,
      "visit_counts": np.ndarray (size × size, int),
      "shortest_path_len": int | None (길이 없으면 None)
    }

- early_success_rate는 미로 수정 직후 탈출 AI의 적응 속도 지표다

---

## 9. 제작 AI (agents/builder.py) — 민규

RuleBasedBuilder(rng), SarsaBuilder(rng) 공통:

- propose_edit(grid, start, goal, report) → edit 또는 None
  - report는 직전 라운드의 성적표 (첫 라운드는 None)
  - 수정할 것이 없으면 None
- learn(prev_report, next_report, edit_reverted) → float
  - 직전 수정의 결과로 보상을 계산해 학습하고 그 보상을 돌려준다
  - RuleBasedBuilder는 학습하지 않고 보상만 계산해 돌려준다
  - SARSA: learn에서 다음 상태와 다음 행동을 먼저 정하고, 그 행동의 Q값으로 업데이트. 다음 propose_edit는 그 행동을 실행
- 속성: builder.last_state, builder.last_action (로그용, 없으면 None)

행동 번호와 이름 (builder_action → builder_action_name):

| 번호 | 이름 | 의미 |
|---|---|---|
| 0 | block_hot | 방문이 가장 많은 칸에 벽 |
| 1 | block_path | 최단 경로 위 칸에 벽 |
| 2 | random_wall | 무작위 빈칸에 벽 |
| 3 | remove_wall | 무작위 벽 제거 |

- 이름 목록은 agents/builder.py의 ACTION_NAMES를 기준으로 하며, Simulation은 이 상수로 builder_action을 builder_action_name으로 변환한다

- 상태는 미로 크기와 무관하게 설계한다 (시대가 바뀌어도 학습 유지)
- 상태·행동 상세 설계는 담당자가 정한다 (agents/AGENTS.md 참고)

---

## 10. 시뮬레이션 (core/simulation.py) — 윤중

    Simulation(builder_mode="sarsa" | "rule", seed=None)

- step() → round_result  (한 라운드 진행 후 결과 반환, API가 반복 호출)
- run_all() → None  (UI·API 없이 끝까지 실행하고 로그만 기록. 발표용 그래프·백업용)
- is_finished() → bool  (마지막 시대가 끝나면 True)
- 속성: sim.round, sim.era, sim.size, sim.grid

한 라운드 진행 순서:
1. Builder가 propose_edit로 수정안을 낸다
2. apply_edit 후 is_solvable 검사. 풀 수 없으면 취소하고 다시 제안받는다
   (최대 MAX_EDIT_RETRY회, 실패하면 이번 라운드는 수정 없음)
3. Q-Learning Solver가 미로에서 ROUND_EPISODES판 run_round
4. 성공률이 0이면 이번 수정을 되돌리고 edit_reverted=True
5. Builder가 learn(이전 성적표, 이번 성적표, edit_reverted)
6. round_result를 로그에 한 줄 기록하고 반환
7. should_advance_era가 True면 next_size로 generate_maze,
   Solver는 reset_for_size, Builder는 그대로 유지

외부(API)에서 사용하는 제어 메서드와 반환 타입은 15번을 따른다

## 11. round_result / 로그 형식

- API가 받는 값과 로그 한 줄의 형식은 같다
- 로그 파일: logs/run_YYYYMMDD_HHMMSS.jsonl (라운드마다 한 줄)

    {
      "round": int,
      "era": int,
      "size": int,
      "start": [int, int],
      "goal": [int, int],
      "grid": 2차원 리스트,
      "edit": edit 또는 null,
      "edit_reverted": bool,
      "reports": {"q": 성적표},
      "best_paths": {"q": [[행, 열], ...]},
      "q_values_max": {"q": 2차원 리스트},
      "builder_mode": "sarsa" | "rule",
      "builder_state": 값 또는 null,
      "builder_action": 값 또는 null,
      "builder_action_name": "block_hot" | "block_path" | "random_wall" | "remove_wall" | null,
      "builder_reward": float,
      "builder_q_table": 3×3×4 리스트 또는 null (SarsaBuilder일 때만),
      "era_changed": bool,
      "next_size": int | null,
      "finished": bool
    }

- q_values_max: 각 칸에서 4방향 Q값 중 최댓값 (히트맵용)
- 로그 저장 시 NumPy 배열은 리스트로 변환

---

## 12. config.py 항목 (초기값, 튜닝 시 이 값만 수정)

| 이름 | 초기값 | 설명 |
|---|---|---|
| SEED | 42 | 랜덤 시드 |
| SEED_OFFSET | maze 0, q 1, builder 3 | 모듈별 시드 오프셋 |
| ENABLE_TRAPS | False | 함정 확장 스위치 |
| ERA_SIZES | [5, 7, 10] | 시대별 미로 크기 |
| WALL_DENSITY | {5: 0.2, 7: 0.25, 10: 0.3} | 초기 벽 비율 |
| MAX_STEPS_FACTOR | 4 | 한 판 최대 걸음 = 4 × n × n |
| ROUND_EPISODES | 50 | Builder 수정 1회당 탈출 도전 횟수 |
| ROUND_EARLY_EPISODES | 10 | early_success_rate 계산 구간 |
| MAX_EDIT_RETRY | 3 | 풀 수 없는 수정 재시도 횟수 |
| REWARD_STEP | -1 | 한 걸음 |
| REWARD_WALL_BUMP | -3 | 벽 충돌 (제자리) |
| REWARD_GOAL | 100 | 탈출 |
| REWARD_TIMEOUT | -50 | 최대 걸음 초과 |
| REWARD_TRAP | -30 | (예약) 함정 |
| ALPHA | 0.1 | Solver 학습률 |
| GAMMA | 0.95 | Solver 할인율 |
| EPSILON_START | 0.3 | 탐험 시작값 |
| EPSILON_MIN | 0.05 | 탐험 최소값 |
| EPSILON_DECAY | 0.995 | 한 판마다 곱함 |
| BUILDER_ALPHA | 0.2 | Builder 학습률 |
| BUILDER_GAMMA | 0.9 | Builder 할인율 |
| BUILDER_EPSILON | 0.2 | Builder 탐험 |
| BUILDER_TARGET_LOW | 0.3 | 목표 성공률 구간 하한 |
| BUILDER_TARGET_HIGH | 0.7 | 목표 성공률 구간 상한 |
| ERA_MIN_ROUNDS | 10 | 시대 최소 라운드 |
| ERA_MAX_ROUNDS | 40 | 시대 최대 라운드 |
| ERA_WINDOW | 5 | 시대 전환 판단 구간 |
| ERA_SUCCESS_THRESHOLD | 0.7 | 시대 전환 성공률 기준 |
| LOG_DIR | "logs" | 로그 폴더 |

---

## 13. 함정 확장 시 할 일 (필수 기능 완료 후)

| 담당 | 할 일 |
|---|---|
| 공동 | config.ENABLE_TRAPS = True |
| 윤중 | environment.py step()에 함정 처리 추가, maze.py apply_edit에 함정 edit 허용 |
| 민규 | builder.py 행동 후보에 "함정 놓기" 추가 (ENABLE_TRAPS일 때만) |
| 규민 | run_round에서 trap_rate 실제 계산 |
| 수암 | maze_view.py에 함정 칸 색 추가, charts.py에 trap_rate 그래프 추가 |

- 완료 조건: 함정 배치가 탈출 AI 경로와 제작 AI 학습에 미치는 영향 확인

---

## 14. 변경 절차

1. 바꾸고 싶은 사람이 팀 채팅에 내용과 이유를 올린다
2. 영향받는 담당자가 동의하면 이 문서와 config.py를 수정해 main에 올린다
3. 팀 채팅에 "인터페이스 변경: (항목)"으로 공지한다
4. 각자 main을 자기 브랜치로 가져오고 pytest tests/ 를 실행한다
- 인터페이스 변경은 가능한 한 1차 통합 시점에 몰아서 한다

---

## 15. 외부 제어 인터페이스 (core/simulation.py → api/) — 구현 윤중, 사용 수암

API(FastAPI·WebSocket)는 이 섹션의 메서드와 타입만 사용한다. 코어 내부 구현은 담당 영역대로 유지한다.

### 15-1. 생성

    Simulation(builder_mode: str = "sarsa", seed: int | None = None)

- builder_mode: "sarsa" | "rule"
- seed: None이면 config.SEED 사용
- 생성 직후 상태는 "idle", 1시대 미로가 만들어진 상태

### 15-2. 상태값 (status)

| 값 | 의미 |
|---|---|
| "idle" | 생성 또는 reset 직후, 아직 시작 전 |
| "running" | 실행 중 (API가 step을 반복 호출하는 상태) |
| "paused" | 일시정지 |
| "finished" | 마지막 시대가 끝나 더 진행할 수 없음 |

### 15-3. 제어 메서드

| 메서드 | 인자 | 반환 | 허용 상태 | 실행 후 상태 |
|---|---|---|---|---|
| start() | 없음 | SimulationState | idle | running |
| pause() | 없음 | SimulationState | running | paused |
| resume() | 없음 | SimulationState | paused | running |
| step() | 없음 | RoundResult | idle, running, paused | 그대로 (마지막 라운드면 finished) |
| reset(builder_mode: str \| None = None, seed: int \| None = None) | None이면 기존 값 유지 | SimulationState | 모든 상태 | idle |
| get_state() | 없음 | SimulationState | 모든 상태 | 그대로 |
| is_finished() | 없음 | bool | 모든 상태 | 그대로 |

run_all()은 API에서 사용하지 않는 헤드리스 실행용이다

- start, pause, resume은 status만 바꾼다. 코어는 스스로 반복 실행하지 않는다
- 반복 실행과 속도 조절은 API가 담당한다: status가 "running"인 동안 step()을 호출하고 결과를 전송한다
- step()은 idle·paused 상태에서도 호출할 수 있다 (한 라운드씩 수동 진행)
- reset()은 미로, 탈출 AI Q-table, 제작 AI Q-table, 기록을 모두 초기화하고 1시대부터 다시 시작한다
- 허용되지 않는 상태에서 호출하면 SimulationStateError(RuntimeError 하위 클래스, core/simulation.py에 정의)를 발생시킨다
  - 예: running에서 start(), finished에서 step()

### 15-4. 반환 타입 공통 규칙

- RoundResult와 SimulationState는 별도 변환 없이 json.dumps가 가능해야 한다
- NumPy 배열·NumPy 숫자·튜플은 반환 전에 list, int, float로 변환한다
- 좌표는 [행, 열] 리스트

### 15-5. RoundResult (step() 반환)

11번 round_result와 같은 구조이며, 각 키의 타입은 아래와 같다.

| 키 | 타입 | 설명 |
|---|---|---|
| round | int | 라운드 번호 (1부터) |
| era | int | 시대 번호 (1부터) |
| size | int | 이번 라운드 미로 크기 |
| start | [int, int] | 시작점 |
| goal | [int, int] | 출구 |
| grid | list[list[int]] | 이번 라운드에 사용된 미로 (수정 반영 후) |
| edit | {"type": str, "pos": [int, int]} \| null | 제작 AI가 적용한 수정 |
| edit_reverted | bool | 성공률 0으로 수정이 되돌려졌는지 |
| reports | {"q": Report} | 탈출 AI 성적표 |
| best_paths | {"q": list[[int, int]]} | 탈출 AI의 현재 최적 경로 |
| q_values_max | {"q": list[list[float]]} | 칸별 최대 Q값 (히트맵용) |
| builder_mode | "sarsa" \| "rule" | 제작 AI 종류 |
| builder_state | [int, int] \| null | 제작 AI 상태 (성공률 구간, 최단 경로 구간) |
| builder_action | int \| null | 제작 AI 행동 번호 (0~3) |
| builder_action_name | str \| null | "block_hot", "block_path", "random_wall", "remove_wall" |
| builder_reward | float | 제작 AI가 이번 라운드에 받은 보상 |
| builder_q_table | list[list[list[float]]] \| null | 3×3×4, rule 모드면 null |
| era_changed | bool | 이번 라운드 후 시대가 바뀌었는지 |
| next_size | int \| null | era_changed가 true면 다음 시대 미로 크기 |
| finished | bool | 시뮬레이션 종료 여부 |

builder_action 번호와 builder_action_name 대응:

| 번호 | 이름 | 의미 |
|---|---|---|
| 0 | block_hot | 방문이 가장 많은 칸에 벽 |
| 1 | block_path | 최단 경로 위 칸에 벽 |
| 2 | random_wall | 무작위 빈칸에 벽 |
| 3 | remove_wall | 무작위 벽 제거 |

- 이름 목록은 agents/builder.py의 ACTION_NAMES를 기준으로 하며, Simulation은 이 상수로 builder_action을 builder_action_name으로 변환한다

Report (JSON):

| 키 | 타입 |
|---|---|
| algo | "q" |
| n_episodes | int |
| success_rate | float (0~1) |
| early_success_rate | float (0~1) |
| trap_rate | float (0~1, 예약: 항상 0.0) |
| avg_steps | float |
| avg_reward | float |
| visit_counts | list[list[int]] |
| shortest_path_len | int \| null |

### 15-6. SimulationState (get_state(), start(), pause(), resume(), reset() 반환)

| 키 | 타입 | 설명 |
|---|---|---|
| status | "idle" \| "running" \| "paused" \| "finished" | 현재 상태 |
| builder_mode | "sarsa" \| "rule" | 제작 AI 종류 |
| seed | int | 사용 중인 시드 |
| round | int | 완료된 라운드 수 (0부터) |
| era | int | 현재 시대 |
| size | int | 현재 미로 크기 |
| start | [int, int] | 시작점 |
| goal | [int, int] | 출구 |
| grid | list[list[int]] | 다음 라운드에 사용될 현재 미로 |
| finished | bool | 종료 여부 |
| last_result | RoundResult \| null | 마지막 step() 결과 |
| history | list[HistoryItem] | 라운드별 요약 (새로 접속한 화면의 그래프 복구용) |

HistoryItem:

| 키 | 타입 |
|---|---|
| round | int |
| era | int |
| size | int |
| success_rate | float |
| early_success_rate | float |
| avg_reward | float |
| avg_steps | float |
| builder_reward | float |
| builder_action_name | str \| null |
| edit_type | str \| null |
| edit_reverted | bool |
| era_changed | bool |

### 15-7. 요청 데이터와 제공 위치

| 필요한 데이터 | 위치 |
|---|---|
| 현재 미로 크기·배열 | SimulationState.size, grid / RoundResult.size, grid |
| 현재 시대·라운드 | SimulationState.era, round / RoundResult.era, round |
| 탈출 AI(Q-Learning) 이동 경로 | RoundResult.best_paths["q"] |
| 탈출 AI 성공률·평균 보상·평균 이동 횟수 | RoundResult.reports["q"] |
| 제작 AI(SARSA) 보상·변경 결과 | RoundResult.builder_reward, edit, edit_reverted, builder_action_name, builder_q_table |
| 시대 전환 여부 | RoundResult.era_changed, next_size |
| 종료 여부 | RoundResult.finished / SimulationState.status, finished |

- SARSA는 제작 AI이므로 미로 안의 이동 경로가 없다. 제작 AI의 결과는 미로 변경(edit)으로 표현한다

### 15-8. API 사용 시 주의

- Simulation은 스레드 안전하지 않다. 한 인스턴스에 대한 호출은 한 번에 하나씩 (asyncio.Lock 등 사용)
- step()은 미로 크기에 따라 수십~수백 ms 걸릴 수 있으므로 이벤트 루프를 막지 않도록 별도 스레드에서 호출 (asyncio.to_thread 등)
- 같은 seed와 builder_mode로 reset하면 같은 결과가 재현된다
