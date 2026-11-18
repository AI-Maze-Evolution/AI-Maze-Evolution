# AI Maze Evolution — 공통 규칙

이 파일은 모든 팀원과 AI 코딩 도구(Codex, Claude Code 등)가 따르는 공통 규칙이다.
모듈 간 약속의 상세 내용은 반드시 docs/interface.md를 따른다.

## 프로젝트 한 줄 요약
미로 제작 AI(Builder: SARSA)와 탈출 AI(Solver: Q-Learning)가 경쟁하며 학습하고,
미로가 5×5 → 7×7 → 10×10으로 커지는 강화학습 시뮬레이터.

## 기술 스택
- Python 3.12, NumPy
- UI: ui/ 폴더와 main.py에서만 사용. 라이브러리는 UI 담당이 확정 (pygame 또는 matplotlib)
- 테스트: pytest
- PyTorch 등 딥러닝 라이브러리 사용 금지, CPU에서 실행

## 담당
| 번호 | 역할 | 파일 | 담당 | 난이도 |
|---|---|---|---|---|
| 1 | 미로 제작 AI (SARSA) | agents/builder.py | 민규 | 높음 |
| 2 | 미로 탈출 AI (Q-Learning) | agents/solver.py | 규민 | 중간 |
| 3 | 환경 및 학습 통합 | core/maze.py, core/environment.py, core/evolution.py, core/simulation.py | 윤중 | 높음 |
| 4 | UI 및 시각화 | ui/dashboard.py, ui/maze_view.py, ui/charts.py, main.py | 수암 | 중간 |

공동 관리 파일: config.py, docs/interface.md, AGENTS.md (팀 합의 후에만 수정)

## 반드시 지킬 것
1. 자기 담당 파일 밖은 수정하지 않는다. 필요하면 담당자에게 요청한다.
2. docs/interface.md에 적힌 함수 이름, 입력, 출력, 반환 순서를 바꾸지 않는다.
3. 보상값·학습률·횟수 등 숫자는 코드에 직접 쓰지 않고 config.py에서 가져온다.
4. 랜덤은 np.random.default_rng(config.SEED + 모듈별 오프셋)으로 만든다.
5. 다른 파일의 함수는 interface.md에 적힌 공개 함수만 사용한다.
6. 함수마다 한국어 docstring으로 입력과 출력을 설명한다.
7. 커밋 전에 pytest tests/ 를 실행하고, 바뀐 파일이 모두 자기 담당인지 확인한다.

## 함정 기능 (후순위)
- 함정은 필수 기능 완료 후 추가할 확장이다. 지금은 config.ENABLE_TRAPS = False
- interface.md에 "예약"으로 표시된 항목은 자리만 만들어 두고 실제 동작은 구현하지 않는다
- ENABLE_TRAPS를 켜는 것은 팀 합의 후에만 한다

## AI 코딩 도구에게
- 작업 범위는 요청받은 파일과 함수로 한정한다.
- 테스트를 통과시키려고 다른 담당자 파일이나 config.py를 수정하지 않는다.
- interface.md와 맞지 않는 요청을 받으면 구현하지 말고 그 사실을 먼저 알린다.
