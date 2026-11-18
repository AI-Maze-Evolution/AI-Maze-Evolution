"""FastAPI REST 및 WebSocket 통신용 Pydantic 스키마 정의.

docs/interface.md 11번·15번 및 벽 이동(move_wall)·경계선 벽(walls) 확장을 수용한다.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

EngineMode = Literal["DEMO", "REAL"]
RequestedEngineMode = Literal["auto", "demo", "real"]
BuilderMode = Literal["sarsa", "rule"]
CoreSimulationStatus = Literal["idle", "running", "paused", "finished"]
SimulationStatus = Literal["idle", "running", "paused", "finished", "error"]
BuilderActionName = Literal[
    "block_hot",
    "block_path",
    "random_wall",
    "remove_wall",
    "move_to_path",
    "move_to_hot",
]


class MazeEditModel(BaseModel):
    """Builder가 적용한 미로 수정 항목 (칸 벽 및 경계선 벽·벽 이동 모두 허용)."""

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    type: Literal["add_wall", "remove_wall", "move_wall", "add_trap", "remove_trap"]
    pos: Any = None
    from_pos: Any = Field(default=None, alias="from")


class SolverReportModel(BaseModel):
    """docs/interface.md 8번 및 15-5번 탈출 AI(Q-Learning) 성적표 모델."""

    algo: Literal["q"]
    n_episodes: int
    success_rate: float
    early_success_rate: float
    trap_rate: float
    avg_steps: float
    avg_reward: float
    visit_counts: list[list[int]]
    shortest_path_len: int | None


class RoundReportsModel(BaseModel):
    """라운드별 탈출 AI 성적표 묶음 (단일 Q-Learning Solver)."""

    q: SolverReportModel


class BestPathsModel(BaseModel):
    """라운드별 탈출 AI의 greedy 이동 경로."""

    q: list[list[int]]


class QValuesMaxModel(BaseModel):
    """각 칸의 최대 Q값 히트맵 행렬."""

    q: list[list[float]]


class RoundResultModel(BaseModel):
    """docs/interface.md 11번 및 15-5번 RoundResult 공식 규격 (+ 경계선 벽 확장 필드)."""

    model_config = ConfigDict(extra="allow")

    round: int
    era: int
    size: int
    start: list[int]
    goal: list[int]
    grid: list[list[int]]
    walls: Any = None
    edit: MazeEditModel | None
    edit_reverted: bool
    reports: RoundReportsModel
    best_paths: BestPathsModel
    q_values_max: QValuesMaxModel
    builder_mode: BuilderMode
    builder_state: list[int] | None = None
    builder_action: int | None = None
    builder_action_name: str | None = None
    builder_reward: float
    builder_q_table: list[list[list[float]]] | None = None
    era_changed: bool
    next_size: int | None = None
    finished: bool


class HistoryItemModel(BaseModel):
    """docs/interface.md 15-6번 HistoryItem 요약 지표."""

    round: int
    era: int
    size: int
    success_rate: float
    early_success_rate: float
    avg_reward: float
    avg_steps: float
    builder_reward: float
    builder_action_name: str | None = None
    edit_type: str | None = None
    edit_reverted: bool
    era_changed: bool


class EditHistoryEntryModel(BaseModel):
    """프론트엔드 Builder 변경 이력 패널용 요약 항목."""

    round: int
    era: int
    size: int
    edit: MazeEditModel | None = None
    edit_type: str | None = None
    edit_reverted: bool
    builder_state: list[int] | None = None
    builder_action: int | None = None
    builder_action_name: str | None = None
    builder_reward: float
    success_rate: float
    shortest_path_len: int | None = None


class SimulationStateResponse(BaseModel):
    """docs/interface.md 15-6번 SimulationState + API 래퍼 메타데이터 응답."""

    model_config = ConfigDict(extra="allow")

    status: SimulationStatus
    builder_mode: BuilderMode
    seed: int
    round: int
    era: int
    size: int
    start: list[int]
    goal: list[int]
    grid: list[list[int]]
    walls: Any = None
    finished: bool
    last_result: RoundResultModel | None = None
    history: list[HistoryItemModel] = Field(default_factory=list)

    mode: EngineMode
    engine_available: bool
    speed: float
    era_sizes: list[int]
    prev_grid: list[list[int]] | None = None
    prev_walls: Any = None
    edit_history: list[EditHistoryEntryModel] = Field(default_factory=list)
    era_transitions: list[int] = Field(default_factory=list)
    error: str | None = None


class HealthResponse(BaseModel):
    """서버 및 어댑터 헬스체크 응답."""

    status: Literal["ok"]
    mode: EngineMode
    engine_available: bool
    simulation_status: SimulationStatus
    active_connections: int


class StartRequest(BaseModel):
    """시뮬레이션 시작 요청 파라미터."""

    speed: float | None = Field(default=None, ge=0.25, le=20.0)
    builder_mode: BuilderMode | None = None
    seed: int | None = None


class ResetRequest(BaseModel):
    """시뮬레이션 초기화 요청 파라미터."""

    builder_mode: BuilderMode | None = None
    seed: int | None = None
    mode: RequestedEngineMode | None = None


class SpeedRequest(BaseModel):
    """시뮬레이션 배속 변경 요청 파라미터."""

    speed: float = Field(ge=0.25, le=20.0)
