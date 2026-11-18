"""Matplotlib 대시보드와 엔진 없이 실행 가능한 명시적 데모."""

from concurrent.futures import ThreadPoolExecutor

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Button, Slider

from ui.charts import Charts
from ui.maze_view import draw_maze


def make_demo_result(round_number=1):
    """1~36 라운드 번호를 받아 규약 11번 형식의 가짜 성적표를 반환한다."""
    if not 1 <= round_number <= 36:
        raise ValueError("Demo round must be between 1 and 36")
    era = (round_number - 1) // 12
    size = (5, 7, 10)[era]
    grid = np.zeros((size, size), dtype=int)
    grid[1:-1:2, 1:-1] = 1
    path_q = [(0, col) for col in range(size)] + [(row, size - 1) for row in range(1, size)]
    path_sarsa = [(row, 0) for row in range(size)] + [(size - 1, col) for col in range(1, size)]
    progress = ((round_number - 1) % 12 + 1) / 12
    reports = {}
    for algo, offset, path in (("q", .08, path_q), ("sarsa", 0, path_sarsa)):
        visits = np.zeros_like(grid)
        for row, col in path:
            visits[row, col] += round_number
        reports[algo] = dict(algo=algo, n_episodes=50, success_rate=min(1., progress + offset),
                             early_success_rate=max(0., progress - .15 + offset), trap_rate=0.,
                             avg_steps=(2 * size - 2) * (2 - progress),
                             avg_reward=100 * progress - 30, visit_counts=visits.tolist(),
                             shortest_path_len=2 * size - 2)
    reports["merged"] = {key: ((np.asarray(reports["q"][key]) + np.asarray(reports["sarsa"][key])).tolist()
                                if key == "visit_counts" else reports["q"][key]
                                if key in ("n_episodes", "shortest_path_len") else
                                (reports["q"][key] + reports["sarsa"][key]) / 2)
                         for key in reports["q"] if key != "algo"}
    reports["merged"]["algo"] = "merged"
    values = np.fromfunction(lambda row, col: (row + col) * progress, (size, size))
    return dict(round=round_number, era=era, size=size, grid=grid.tolist(),
                edit={"type": "add_wall", "pos": (1, 1)}, edit_reverted=False, reports=reports,
                best_paths={"q": path_q, "sarsa": path_sarsa},
                q_values_max={"q": values.tolist(), "sarsa": (values * .85).tolist()},
                builder_state=None, builder_action=None, builder_reward=1 - 2 * abs(progress - .5),
                era_changed=round_number in (12, 24), finished=round_number == 36)


class DemoSimulation:
    """학습을 수행하지 않는 UI 점검용 Simulation 대역."""

    def __init__(self):
        """초기 데모 상태를 만들며 입력과 반환값은 없다."""
        self.round, self.era, self.size = 0, 0, 5
        self.grid = make_demo_result()["grid"]

    def step_round(self):
        """다음 가짜 라운드를 반환하며 종료 이후에는 StopIteration을 발생시킨다."""
        if self.is_finished():
            raise StopIteration("Demo finished")
        result = make_demo_result(self.round + 1)
        self.round, self.era, self.size = result["round"], result["era"], result["size"]
        self.grid = result["grid"]
        return result

    def is_finished(self):
        """데모 종료 여부를 bool로 반환한다."""
        return self.round >= 36


class Dashboard:
    """단일 작업 스레드에서 학습하고 GUI 스레드에서만 화면을 갱신한다."""

    def __init__(self, simulation, demo=False):
        """Simulation 호환 객체와 데모 여부를 받아 대시보드를 만든다."""
        self.sim = simulation
        self.running = False
        self.closed = False
        self.failed = False
        self.finished = False
        self.speed = 1
        self.future = None
        self.latest = None
        self.pending_draws = 0
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.fig = plt.figure(figsize=(16, 10), facecolor="#f5f7fb")
        self.fig.suptitle("AI MAZE EVOLUTION" + ("  /  DEMO · synthetic data" if demo else ""),
                          x=.04, ha="left", weight="bold", fontsize=18)
        layout = self.fig.add_gridspec(3, 6, left=.05, right=.96, bottom=.17, top=.88,
                                      hspace=.65, wspace=.9)
        self.maze_axes = [self.fig.add_subplot(layout[0, i:i + 2]) for i in (0, 2, 4)]
        chart_axes = [self.fig.add_subplot(layout[1, i:i + 2]) for i in (0, 2, 4)]
        chart_axes += [self.fig.add_subplot(layout[2, :3]), self.fig.add_subplot(layout[2, 3:])]
        self.charts = Charts(chart_axes)
        self.status = self.fig.text(.05, .92, f"Ready · era {simulation.era} · {simulation.size}×{simulation.size} · round {simulation.round}", fontsize=11)
        self.detail = self.fig.text(.05, .035, "Purple outline: builder edit / dashed red: reverted", fontsize=9)
        self.start_button = Button(self.fig.add_axes((.05, .08, .12, .045)), "Start / Pause")
        self.step_button = Button(self.fig.add_axes((.19, .08, .10, .045)), "Step round")
        self.slider = Slider(self.fig.add_axes((.43, .085, .35, .025)), "Speed", 1, 20, valinit=1, valstep=1)
        self.start_button.on_clicked(self.toggle)
        self.step_button.on_clicked(self.step)
        self.slider.on_changed(self.set_speed)
        self.fig.canvas.mpl_connect("close_event", self.close)
        initial = dict(grid=simulation.grid, best_paths={}, edit=None)
        draw_maze(self.maze_axes[0], initial)
        for ax in self.maze_axes[1:]:
            ax.set_title("Q values · waiting for first round")
            ax.set_axis_off()
        self.charts.draw()
        self.timer = self.fig.canvas.new_timer(interval=1000)
        self.timer.add_callback(self.tick)
        self.timer.start()

    def toggle(self, event=None):
        """버튼 이벤트를 받아 자동 진행을 시작하거나 일시정지한다."""
        if self.closed or self.failed or self.finished:
            return
        self.running = not self.running
        self.status.set_text("Running…" if self.running else "Paused · current round may finish")
        self.fig.canvas.draw_idle()

    def set_speed(self, value):
        """배속 값을 받아 라운드 요청 간격을 조절한다."""
        self.speed = int(value)
        self.timer.interval = max(20, 1000 // self.speed)

    def step(self, event=None):
        """유휴 상태라면 한 라운드를 작업 스레드에 제출한다."""
        if self.closed or self.failed or self.finished or self.future is not None:
            return
        if self.sim.is_finished():
            self.finished = True
            self.running = False
            self.status.set_text("Finished")
            self.fig.canvas.draw_idle()
            return
        self.future = self.executor.submit(self.sim.step_round)

    def tick(self):
        """완료된 결과를 수집하고 실행 중이면 다음 라운드를 요청한다."""
        if self.closed:
            return
        if self.future is not None and self.future.done():
            future, self.future = self.future, None
            try:
                self.latest = future.result()
                self.charts.append(self.latest)
                self.pending_draws += 1
                self.finished = self.latest["finished"] or self.sim.is_finished()
                if self.finished:
                    self.running = False
                if not self.running or self.latest["era_changed"] or self.pending_draws >= max(1, self.speed // 4):
                    self.render()
            except Exception as error:
                self.running, self.failed = False, True
                self.status.set_text(f"Error · {type(error).__name__}: {error}")
                self.fig.canvas.draw_idle()
        if not self.running and self.pending_draws:
            self.render()
        if self.running:
            self.step()

    def render(self):
        """최신 성적표를 미로 및 그래프에 반영한다."""
        result = self.latest
        for ax, algo in zip(self.maze_axes, (None, "q", "sarsa")):
            ax.set_axis_on()
            draw_maze(ax, result, algo)
        self.charts.draw()
        mode = "Finished" if self.finished else "Running" if self.running else "Paused"
        rates = " / ".join(f"{algo.upper()} {result['reports'][algo]['success_rate']:.0%}" for algo in ("q", "sarsa", "merged"))
        self.status.set_text(f"{mode} · era {result['era']} · {result['size']}×{result['size']} · round {result['round']}     {rates}")
        self.pending_draws = 0
        self.fig.canvas.draw_idle()

    def close(self, event=None):
        """창 닫기 이벤트를 받아 타이머와 후속 작업 제출을 중단한다."""
        self.closed, self.running = True, False
        self.timer.stop()
        self.executor.shutdown(wait=False, cancel_futures=True)

    def run(self):
        """창을 표시하고 닫힐 때까지 이벤트 루프를 실행한다."""
        try:
            plt.show()
        finally:
            self.close()
