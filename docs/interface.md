# 인터페이스 약속

이 문서가 모듈 간 약속의 유일한 기준이다. 변경은 팀 합의 후에만 한다.
"(예약)"이 붙은 항목은 함정 확장용으로 자리만 만들어 두고 지금은 동작하지 않는다.

---

## 1. 폴더 구조

    maze_evolution/
    ├── AGENTS.md / CLAUDE.md
    ├── config.py                   공동
    ├── main.py                     수암
    ├── docs/interface.md           공동
    ├── core/                       윤중
    │   ├── AGENTS.md
    │   ├── maze.py                 미로 표현, BFS, 미로 생성·수정
    │   ├── environment.py          MazeEnv
    │   ├── evolution.py            시대 전환
    │   └── simulation.py           Simulation, merge_reports, 로그
    ├── agents/
    │   ├── AGENTS.md
    │   ├── builder.py              민규
    │   └── solver.py               규민
    ├── ui/                         수암
    │   ├── AGENTS.md
    │   ├── dashboard.py
    │   ├── maze_view.py
    │   └── charts.py
    ├── tests/
    └── logs/                       git에 올리지 않음

## 의존 방향 (거꾸로 import 금지)

    ui/, main.py  →  core/simulation.py  →  agents/  →  core/maze.py, core/environment.py

- agents/는 ui/를 import하지 않는다
- core/는 ui/를 import하지 않는다
- ui/는 core/simulation.py와 config.py만 import한다

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
  - history: 현재 시대의 라운드별 통합 성공률 리스트
  - rounds_in_era ≥ ERA_MIN_ROUNDS 이고 최근 ERA_WINDOW 라운드 평균 ≥ ERA_SUCCESS_THRESHOLD 이면 True
  - rounds_in_era ≥ ERA_MAX_ROUNDS 이면 무조건 True
- next_size(size) → int 또는 None  (ERA_SIZES의 다음 크기, 마지막이면 None)

---

## 7. 탈출 AI (agents/solver.py) — 규민

QLearningAgent(size, rng), SarsaAgent(size, rng) 공통:

- select_action(state, greedy=False) → int
  - greedy=False면 ε-greedy, True면 Q값 최대 행동
- update(state, action, reward, next_state, next_action, done) → None
  - Q-Learning: next_action을 무시하고 다음 상태의 최대 Q값 사용
  - SARSA: next_action의 Q값 사용
  - 두 AI가 같은 모양을 쓰도록 next_action은 항상 넘긴다
- decay_epsilon() → None  (한 판 끝날 때마다 호출)
- reset_for_size(size) → None  (시대가 바뀌면 Q-table을 새 크기로 초기화)
- greedy_path(env) → list[(행, 열)]  (탐험 없이 움직인 경로, 최대 env.max_steps 걸음)
- 속성: agent.q_table (size × size × 4), agent.epsilon, agent.name ("q" 또는 "sarsa")

run_round(env, agent, n_episodes) → report

## 8. 성적표 (report)

    {
      "algo": "q" | "sarsa" | "merged",
      "n_episodes": int,
      "success_rate": float (0~1),
      "early_success_rate": float (0~1),   이번 라운드 처음 ROUND_EARLY_EPISODES판의 성공률
      "trap_rate": float (0~1),            (예약) 지금은 항상 0.0
      "avg_steps": float,
      "avg_reward": float,
      "visit_counts": np.ndarray (size × size, int),
      "shortest_path_len": int
    }

- early_success_rate는 미로가 수정된 직후 얼마나 빨리 적응하는지 비교하는 핵심 지표다
- 통합 성적표(merge_reports): 비율과 평균은 두 AI의 평균, visit_counts는 합, algo는 "merged"

---

## 9. 제작 AI (agents/builder.py) — 민규

RuleBasedBuilder(rng), QBuilder(rng) 공통:

- propose_edit(grid, start, goal, report) → edit 또는 None
  - report는 직전 라운드의 통합 성적표 (첫 라운드는 None)
  - 수정할 것이 없으면 None
- learn(prev_report, next_report, edit_reverted) → float
  - 직전 수정의 결과로 보상을 계산해 학습하고 그 보상을 돌려준다
  - RuleBasedBuilder는 학습하지 않고 보상만 계산해 돌려준다
- 속성: builder.last_state, builder.last_action (로그용, 없으면 None)
- 상태는 미로 크기와 무관하게 설계한다 (시대가 바뀌어도 학습 유지)
- 상태·행동 상세 설계는 담당자가 정한다 (agents/AGENTS.md 참고)

---

## 10. 시뮬레이션 (core/simulation.py) — 윤중

    Simulation(builder_mode="q" | "rule")

- step_round() → round_result  (한 라운드 진행 후 결과 반환, UI가 반복 호출)
- run_all() → None  (UI 없이 끝까지 실행, 로그만 기록)
- is_finished() → bool  (마지막 시대가 끝나면 True)
- 속성: sim.round, sim.era, sim.size, sim.grid

한 라운드 진행 순서:
1. Builder가 propose_edit로 수정안을 낸다
2. apply_edit 후 is_solvable 검사. 풀 수 없으면 취소하고 다시 제안받는다
   (최대 MAX_EDIT_RETRY회, 실패하면 이번 라운드는 수정 없음)
3. Q-Learning, SARSA Solver가 같은 미로에서 각각 ROUND_EPISODES판씩 run_round
4. merge_reports로 통합 성적표를 만든다
5. 통합 성공률이 0이면 이번 수정을 되돌리고 edit_reverted=True
6. Builder가 learn(이전 통합 성적표, 이번 통합 성적표, edit_reverted)
7. round_result를 로그에 한 줄 기록하고 반환
8. should_advance_era가 True면 next_size로 generate_maze,
   Solver는 reset_for_size, Builder는 그대로 유지

## 11. round_result / 로그 형식

- UI가 받는 값과 로그 한 줄의 형식은 같다
- 로그 파일: logs/run_YYYYMMDD_HHMMSS.jsonl (라운드마다 한 줄)

    {
      "round": int,
      "era": int,
      "size": int,
      "grid": 2차원 리스트,
      "edit": edit 또는 null,
      "edit_reverted": bool,
      "reports": {"q": 성적표, "sarsa": 성적표, "merged": 성적표},
      "best_paths": {"q": [[행, 열], ...], "sarsa": [[행, 열], ...]},
      "q_values_max": {"q": 2차원 리스트, "sarsa": 2차원 리스트},
      "builder_state": 값 또는 null,
      "builder_action": 값 또는 null,
      "builder_reward": float,
      "era_changed": bool,
      "finished": bool
    }

- q_values_max: 각 칸에서 4방향 Q값 중 최댓값 (히트맵용)
- 로그 저장 시 NumPy 배열은 리스트로 변환

---

## 12. config.py 항목 (초기값, 튜닝 시 이 값만 수정)

| 이름 | 초기값 | 설명 |
|---|---|---|
| SEED | 42 | 랜덤 시드 |
| SEED_OFFSET | maze 0, q 1, sarsa 2, builder 3 | 모듈별 시드 오프셋 |
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

---

## 14. 변경 절차

1. 바꾸고 싶은 사람이 팀 채팅에 내용과 이유를 올린다
2. 영향받는 담당자가 동의하면 이 문서와 config.py를 수정해 main에 올린다
3. 팀 채팅에 "인터페이스 변경: (항목)"으로 공지한다
4. 각자 main을 자기 브랜치로 가져오고 pytest tests/ 를 실행한다
- 인터페이스 변경은 가능한 한 1차 통합 시점에 몰아서 한다
