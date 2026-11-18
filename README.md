# AI Maze Evolution

미로 제작 AI(Builder: SARSA)와 탈출 AI(Solver: Q-Learning)가 경쟁하며 학습하고,
미로가 5×5 → 7×7 → 10×10으로 커지는 강화학습 시뮬레이터.

## 담당

| 번호 | 역할 | 파일 | 담당 |
|---|---|---|---|
| 1 | 미로 제작 AI (SARSA) | agents/builder.py | 민규 |
| 2 | 미로 탈출 AI (Q-Learning) | agents/solver.py | 규민 |
| 3 | 환경 및 학습 통합 | core/maze.py, core/environment.py, core/evolution.py, core/simulation.py | 윤중 |
| 4 | 프론트엔드 및 API | frontend/, api/ | 수암 |

## 시작하기

1. 저장소 clone
2. Python 3.12 가상환경(.venv) 생성
3. pip install -r requirements.txt
4. 자기 브랜치 생성 후 작업
5. AI 도구(Codex, Claude Code)는 반드시 프로젝트 루트에서 실행

## 규칙

- 공통 규칙: AGENTS.md
- 모듈 간 약속: docs/interface.md
- 폴더별 규칙: core/AGENTS.md, agents/AGENTS.md, ui/AGENTS.md
- 자기 담당 파일 밖은 수정하지 않는다
- 커밋 전 pytest tests/ 실행

## 브랜치

| 브랜치 | 담당 |
|---|---|
| feat/builder | 민규 |
| feat/solver | 규민 |
| feat/core | 윤중 |
| feat/ui | 수암 |

- main에는 PR로만 합친다
- 합치는 시점: 1차 통합, 확장 종료
