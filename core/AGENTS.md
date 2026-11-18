# core/ — 환경 및 학습 통합

## 담당자
- 윤중

## 파일별 역할
- maze.py: 미로 표현 상수, BFS(is_solvable, shortest_path, shortest_path_len), generate_maze, apply_edit
- environment.py: MazeEnv (reset, step, set_grid)
- evolution.py: should_advance_era, next_size
- simulation.py: Simulation (step_round, run_all, is_finished), 로그 기록

## 다른 파일에 공개하는 것 (변경 시 팀 합의)
- interface.md 2, 4, 5, 6, 10, 11번 항목 전부
- interface.md 15번 외부 제어 인터페이스

## 가져다 쓰는 것
- agents/solver.py: QLearningAgent, run_round
- agents/builder.py: RuleBasedBuilder, SarsaBuilder
- config.py 전체

## 작업 순서
1. maze.py와 environment.py를 최우선으로 완성 (규민·민규가 바로 필요로 함)
2. simulation.py는 가짜 Solver·Builder(고정값 반환)로 전체 흐름을 먼저 연결
3. 실제 Solver·Builder가 오면 교체
4. evolution.py와 시대 전환 연결
5. 15번 제어 메서드(start, pause, resume, step, reset, get_state)와 JSON 변환 구현

## 주의할 점
- apply_edit는 원본 grid를 절대 바꾸지 않는다
- Solver는 하나(QLearningAgent)만 실행한다
- 함정(예약) 처리 코드는 지금 넣지 않는다. BFS만 TRAP을 막힌 칸으로 처리
- ui/를 import하지 않는다

## 테스트
- tests/test_maze.py
  - 완전히 막힌 미로에서 is_solvable이 False
  - generate_maze 결과는 항상 is_solvable이 True
  - apply_edit로 시작점·출구를 바꾸면 ValueError
  - ENABLE_TRAPS가 False일 때 add_trap edit는 ValueError
- tests/test_environment.py
  - 벽 방향으로 움직이면 제자리 + REWARD_WALL_BUMP
  - 출구 도착 시 done=True, info["result"]=="goal"
  - max_steps 도달 시 info["result"]=="timeout"
- tests/test_simulation.py
  - 가짜 Solver·Builder로 step_round 3번이 에러 없이 끝난다
  - round_result에 interface.md 11번의 키가 모두 있다
  - step·get_state 결과가 json.dumps 가능
  - 허용되지 않는 상태 전환 시 SimulationStateError
