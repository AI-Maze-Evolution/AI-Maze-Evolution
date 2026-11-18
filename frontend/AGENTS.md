# frontend/ — React 웹 시뮬레이터

## 담당자
- 수암

## 폴더별 역할
- `src/types/simulation.ts`: `docs/interface.md` 15번 규격과 1:1 대응하는 TypeScript 타입 (`RoundResult`, `SimulationState`, `HistoryItem`)
- `src/services/api.ts`, `src/services/websocket.ts`: REST 제어 클라이언트 및 자동 재연결 WebSocket 클라이언트
- `src/hooks/useSimulationSocket.ts`: WebSocket 스냅샷/라운드 업데이트 구독 및 제어 액션 훅
- `src/maze/`: 동적 SVG 미로 렌더러(`MazeRenderer`), Q-Learning 경로·토큰 애니메이션(`AgentRenderer`), 범례(`MazeLegend`)
- `src/charts/`: Recharts 기반 Q-Learning 성공률/초기 적응률(`SuccessChart`), 평균 보상(`RewardChart`), 평균 걸음(`StepsChart`), Builder 보상·행동 분포(`BuilderChart`)
- `src/components/`: `Header`, `StatusBar`, `ControlPanel`, `MazeGrid`, `AgentPanel`, `BuilderPanel`, `MetricCard`

## 데이터 규칙 (`docs/interface.md` 15번)
1. 탈출 AI는 **Q-Learning 단일 Solver**(`reports.q`, `best_paths.q`, `q_values_max.q`)만 렌더링한다.
2. 제작 AI는 **SARSA Builder (`"sarsa"`)** 또는 **Rule-Based (`"rule"`)** 이며, 미로 안 이동 경로 대신 수정(`edit`), 행동 이름(`builder_action_name`), 3×3×4 Q-table(`builder_q_table`) 히트맵으로 표현한다 (`rule` 모드는 `null` 처리).
3. 시대 번호(`era`)는 **1부터 시작**한다 (`Era 1: 5×5 → Era 2: 7×7 → Era 3: 10×10`).
4. 경로·Q 히트맵·방문 횟수는 반드시 `last_result.grid`에 겹쳐 그려 시대 전환 직후 `SimulationState.grid`(다음 시대 크기)와 섞이지 않게 한다.
5. `DEMO` 모드일 때는 헤더와 상태 바에 합성 데이터임을 명확히 표시한다.

## 개발 및 빌드
```bash
cd frontend
npm ci
npm run typecheck
npm run build
```
