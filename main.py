"""헤드리스 학습 실행 진입점.

웹 UI 서버는 `uvicorn api.main:app --reload --port 8000`으로 실행한다.
실행 예시:
    python main.py --headless --builder-mode sarsa
    python main.py --headless --builder-mode rule --seed 42
"""

import argparse


def main(argv=None):
    """명령행 인자를 받아 헤드리스 학습 또는 레거시 데모를 실행하고 종료 코드를 반환한다."""
    parser = argparse.ArgumentParser(description="AI Maze Evolution runner")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run training without importing UI libraries",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Display legacy matplotlib demo without the training engine",
    )
    parser.add_argument(
        "--builder-mode",
        choices=("sarsa", "rule"),
        default="sarsa",
        help="Builder AI mode (sarsa or rule)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional random seed (defaults to config.SEED)",
    )
    args = parser.parse_args(argv)
    if args.demo and args.headless:
        parser.error("--demo and --headless cannot be combined")

    if not args.demo:
        try:
            from core.simulation import Simulation

            kwargs = {"builder_mode": args.builder_mode}
            if args.seed is not None:
                kwargs["seed"] = args.seed
            simulation = Simulation(**kwargs)
        except ModuleNotFoundError as error:
            parser.exit(
                1,
                f"Training dependency missing: {error.name}. "
                "Integrate core/simulation.py or run the web API: uvicorn api.main:app --port 8000\n",
            )
        simulation.run_all()
        return 0

    try:
        from ui.dashboard import Dashboard, DemoSimulation
    except ModuleNotFoundError as error:
        parser.exit(1, f"UI dependency missing: {error.name}. Run: python -m pip install numpy matplotlib\n")
    Dashboard(DemoSimulation(), demo=True).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
