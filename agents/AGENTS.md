# agents/ — 제작 AI와 탈출 AI

이 폴더는 두 명이 나눠 쓴다. 자기 담당 파일만 수정한다.

---

## builder.py — 미로 제작 AI

### 담당자
- 민규

### 공개하는 것 (변경 시 팀 합의)
- RuleBasedBuilder, SarsaBuilder: propose_edit, learn, last_state, last_action

### 가져다 쓰는 것
- core/maze.py: shortest_path, shortest_path_len, WALL, EMPTY
- config.py: BUILDER_*, ENABLE_TRAPS, SEED

### 작업 순서
1. RuleBasedBuilder 완성 (Simulation 1차 통합용)
2. SarsaBuilder로 확장

### 초기 설계안 (담당자가 내부에서 자유롭게 변경 가능)
- 상태: (성공률 구간, 최단 경로 구간)
  - 성공률 구간: 0 = 0.3 미만, 1 = 0.3~0.7, 2 = 0.7 초과
  - 최단 경로 구간: 최단 경로 걸음 ÷ (2n-2) 가 1.2 이하 = 0, 1.6 이하 = 1, 초과 = 2
- 행동:
  - 0 = 가장 많이 방문된 칸에 벽 (block_hot)
  - 1 = 현재 최단 경로 위의 칸에 벽 (block_path)
  - 2 = 무작위 빈칸에 벽 (random_wall)
  - 3 = 무작위 벽 하나 제거 (remove_wall)
  - (예약) 4 = 많이 방문된 칸 근처에 함정 — ENABLE_TRAPS일 때만 후보에 추가
- 보상:
  - 이번 성공률이 BUILDER_TARGET_LOW~HIGH 사이면 +1
  - HIGH 초과면 0 (너무 쉬움)
  - LOW 미만이면 -0.5, 성공률 0이라 수정이 취소되면 -1
  - 최단 경로가 길어졌으면 +0.2 가산

### 주의할 점
- 시작점·출구는 수정 대상으로 고르지 않는다
- 상태는 미로 크기와 무관해야 한다
- 학습 기회가 적으므로 상태·행동 개수를 늘리지 않는다

### 테스트 (tests/test_builder.py)
- propose_edit가 interface.md 4번 형식의 edit를 돌려준다
- 시작점·출구를 수정 대상으로 고르지 않는다
- ENABLE_TRAPS가 False면 함정 edit를 내지 않는다
- 성공률 구간별로 learn이 설계한 보상을 돌려준다

---

## solver.py — 미로 탈출 AI

### 담당자
- 규민

### 공개하는 것 (변경 시 팀 합의)
- QLearningAgent: select_action, update, decay_epsilon,
  reset_for_size, greedy_path, q_table, epsilon, name
- run_round(env, agent, n_episodes) → report

### 가져다 쓰는 것
- core/environment.py: MazeEnv의 reset, step
- core/maze.py: shortest_path_len
- config.py: ALPHA, GAMMA, EPSILON_*, ROUND_EARLY_EPISODES, SEED

### 주의할 점
- 미로가 수정되어도 Q-table은 유지한다. 시대가 바뀔 때만 reset_for_size
- 성적표의 trap_rate는 지금 항상 0.0으로 채운다 (예약)
- core/environment.py가 오기 전에는 벽 없는 간단한 가짜 환경으로 개발한다

### 테스트 (tests/test_solver.py)
- 벽 없는 5×5에서 500판 학습 후 성공률 0.9 이상 (QLearningAgent)
- update 후 q_table 값이 바뀐다
- 학습된 상태에서 greedy_path가 출구에서 끝난다
- 성적표에 interface.md 8번의 키가 모두 있다
