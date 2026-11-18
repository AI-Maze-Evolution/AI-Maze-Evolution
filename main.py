"""실행: python main.py --demo / python main.py --headless."""

import argparse


def main(argv=None):
    """명령행 인자를 받아 실제 학습 또는 UI 데모를 실행하고 종료 코드를 반환한다."""
    parser = argparse.ArgumentParser(description="AI Maze Evolution dashboard")
    parser.add_argument("--headless", action="store_true", help="Run training without importing UI libraries")
    parser.add_argument("--demo", action="store_true", help="Display synthetic data without the training engine")
    parser.add_argument("--builder-mode", choices=("q", "rule"), default="q")
    args = parser.parse_args(argv)
    if args.demo and args.headless:
        parser.error("--demo and --headless cannot be combined")
    if not args.demo:
        try:
            from core.simulation import Simulation
            simulation = Simulation(builder_mode=args.builder_mode)
        except ModuleNotFoundError as error:
            parser.exit(1, f"Training dependency missing: {error.name}. Install requirements and integrate core/config modules; use --demo to preview UI.\n")
        if args.headless:
            simulation.run_all()
            return 0
    try:
        from ui.dashboard import Dashboard, DemoSimulation
    except ModuleNotFoundError as error:
        parser.exit(1, f"UI dependency missing: {error.name}. Run: python -m pip install numpy matplotlib\n")
    if args.demo:
        simulation = DemoSimulation()
    Dashboard(simulation, demo=args.demo).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
