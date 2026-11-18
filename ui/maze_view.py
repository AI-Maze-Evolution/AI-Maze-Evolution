"""미로, 경로 및 Q값을 그리는 UI 전용 모듈."""

import numpy as np
from matplotlib.colors import ListedColormap
from matplotlib.patches import Rectangle


def draw_maze(ax, result, algorithm=None):
    """축과 round_result를 받아 미로를 그린다. algorithm 지정 시 Q 히트맵을 반환한다."""
    ax.clear()
    grid = np.asarray(result["grid"])
    n = grid.shape[0]
    image = None
    if algorithm:
        values = np.asarray(result["q_values_max"][algorithm], dtype=float)
        image = ax.imshow(np.ma.masked_where(grid == 1, values), cmap="viridis")
        ax.set_facecolor("#243247")
    else:
        ax.imshow(grid, cmap=ListedColormap(["#edf3fa", "#243247"]), vmin=0, vmax=1)
    for algo, color in (("q", "#0284c7"), ("sarsa", "#e87924")):
        if algorithm and algo != algorithm:
            continue
        path = np.asarray(result["best_paths"].get(algo, []))
        if path.size:
            ax.plot(path[:, 1], path[:, 0], color=color, linewidth=2,
                    linestyle="-" if algo == "q" else "--", label=algo.upper())
    edit = result.get("edit")
    if edit:
        row, col = edit["pos"]
        ax.add_patch(Rectangle((col - .45, row - .45), .9, .9, fill=False,
                               edgecolor="#ef4444" if result["edit_reverted"] else "#a855f7",
                               linewidth=3, linestyle="--" if result["edit_reverted"] else "-"))
    for row, col, label in ((0, 0, "S"), (n - 1, n - 1, "G")):
        ax.text(col, row, label, ha="center", va="center", weight="bold",
                color="white", bbox=dict(boxstyle="round,pad=.2", facecolor="#0f766e", edgecolor="none"))
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xlim(-.5, n - .5)
    ax.set_ylim(n - .5, -.5)
    ax.set_title(f"{algorithm.upper()} · max Q" if algorithm else "Maze · solver paths")
    ax.tick_params(labelsize=8)
    if ax.get_legend_handles_labels()[0]:
        ax.legend(loc="upper left", fontsize=7)
    return image
