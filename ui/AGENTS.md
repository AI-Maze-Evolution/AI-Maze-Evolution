이 폴더는 사용하지 않는다. 프론트엔드·API는 frontend/, api/에서 수암이 담당하며 규칙은 해당 폴더 AGENTS.md를 따른다

# ui/ — UI 및 시각화

## 담당자
- 수암 (main.py 포함)

## 파일별 역할
- dashboard.py: 메인 화면. 시작·일시정지, 학습 배속, 현재 시대·크기·라운드, 성공률 표시
- maze_view.py: 미로 그리기, Builder가 수정한 칸 강조, 탈출 AI의 best_paths, Q값 히트맵
- charts.py: 라운드별 success_rate, early_success_rate, avg_steps, avg_reward(탈출 AI),
  builder_reward, 제작 AI 행동 선택 기록, builder_q_table 히트맵, 시대 전환 지점 세로선
  (실험 비교는 rule vs sarsa 제작 AI)
- main.py: Simulation을 만들고 Dashboard 실행. --headless 옵션이면 sim.run_all()만 실행

## 가져다 쓰는 것
- core/simulation.py: Simulation (step, is_finished, round, era, size, grid)
- config.py
- 그 외 core/, agents/ 는 import하지 않는다

## 동작 방식
- Dashboard가 sim.step()을 반복 호출하고 받은 round_result로 화면을 갱신한다
- 일시정지 = 호출 중단, 배속 = 호출 간격 조절
- round_result 형식은 interface.md 11번 기준

## 작업 순서
1. interface.md 11번 형식으로 가짜 round_result를 만드는 함수부터 작성
2. 가짜 데이터로 maze_view, charts, dashboard 완성
3. Simulation이 준비되면 실제 연결

## 주의할 점
- 화면 갱신이 학습을 느리게 하지 않도록, 배속이 높을 때는 몇 라운드마다 한 번만 그린다
- 함정 칸 색은 지금 넣지 않는다 (예약)

## 테스트 (tests/test_ui.py)
- 가짜 round_result로 maze_view, charts 함수가 에러 없이 그림을 만든다
