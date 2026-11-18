"""라운드 성적표 누적 그래프."""

COLORS = {"q": "#0284c7", "sarsa": "#e87924", "merged": "#0f766e"}
METRICS = (
    ("success_rate", "Success rate", ("q", "sarsa", "merged")),
    ("early_success_rate", "Early adaptation", ("q", "sarsa")),
    ("avg_steps", "Average steps", ("q", "sarsa")),
    ("avg_reward", "Average reward", ("q", "sarsa")),
    ("builder_reward", "Builder reward", ()),
)


class Charts:
    """다섯 개 축에 성적표를 누적한다. 미로 배열은 보관하지 않는다."""

    def __init__(self, axes):
        """다섯 개 Axes를 받아 빈 기록을 생성한다."""
        self.axes = list(axes)
        if len(self.axes) != len(METRICS):
            raise ValueError("Charts requires five axes")
        self.history = []
        self.transitions = []
        self.last_era = None

    def append(self, result):
        """round_result의 스칼라 지표만 저장하며 반환값은 없다."""
        if self.last_era is not None and result["era"] != self.last_era:
            self.transitions.append(result["round"] - .5)
        self.last_era = result["era"]
        self.history.append({"round": result["round"], "builder_reward": result["builder_reward"],
                             "reports": {algo: {metric: result["reports"][algo][metric]
                                                for metric, _, _ in METRICS if metric != "builder_reward"}
                                         for algo in COLORS}})

    def draw(self):
        """저장한 성적표를 축에 그리며 반환값은 없다."""
        rounds = [item["round"] for item in self.history]
        for ax, (metric, title, algorithms) in zip(self.axes, METRICS):
            ax.clear()
            for algo in algorithms:
                ax.plot(rounds, [r["reports"][algo][metric] for r in self.history],
                        label=algo.upper(), color=COLORS[algo], linewidth=1.7)
            if not algorithms:
                ax.plot(rounds, [r[metric] for r in self.history], color="#8b5cf6")
            for boundary in self.transitions:
                ax.axvline(boundary, color="#94a3b8", linestyle=":", linewidth=1)
            if "rate" in metric:
                ax.set_ylim(0, 1.05)
            ax.set_title(title, fontsize=10, loc="left")
            ax.set_xlabel("Round", fontsize=8)
            ax.grid(alpha=.15)
            ax.tick_params(labelsize=8)
            if algorithms:
                ax.legend(fontsize=7, loc="best")
