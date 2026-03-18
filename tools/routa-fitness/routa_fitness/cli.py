"""CLI entry point — wires all modules together, feature parity with fitness.py."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from routa_fitness.evidence import load_dimensions, validate_weights
from routa_fitness.governance import GovernancePolicy, filter_dimensions, enforce
from routa_fitness.model import Tier
from routa_fitness.reporters.terminal import TerminalReporter
from routa_fitness.runners.shell import ShellRunner
from routa_fitness.scoring import score_dimension, score_report


def _find_project_root() -> Path:
    """Walk up from CWD to find the project root (contains package.json or Cargo.toml)."""
    cwd = Path.cwd().resolve()
    for parent in [cwd, *cwd.parents]:
        if (parent / "package.json").exists() or (parent / "Cargo.toml").exists():
            return parent
    return cwd


def _find_fitness_dir(project_root: Path) -> Path:
    """Locate the docs/fitness/ directory relative to project root."""
    fitness_dir = project_root / "docs" / "fitness"
    if not fitness_dir.is_dir():
        print(f"Error: fitness directory not found at {fitness_dir}")
        sys.exit(1)
    return fitness_dir


def cmd_run(args: argparse.Namespace) -> int:
    """Run fitness checks (main command)."""
    project_root = _find_project_root()
    fitness_dir = _find_fitness_dir(project_root)

    tier_filter = Tier(args.tier) if args.tier else None
    policy = GovernancePolicy(
        tier_filter=tier_filter,
        parallel=args.parallel,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )

    reporter = TerminalReporter(verbose=policy.verbose)
    reporter.print_header(
        dry_run=policy.dry_run,
        tier=args.tier,
        parallel=policy.parallel,
    )

    dimensions = load_dimensions(fitness_dir)
    dimensions = filter_dimensions(dimensions, policy)

    runner = ShellRunner(project_root)
    dimension_scores = []

    for dim in dimensions:
        print(f"\n## {dim.name.upper()} (weight: {dim.weight}%)")
        print(f"   Source: {dim.source_file}")

        results = runner.run_batch(
            dim.metrics, parallel=policy.parallel, dry_run=policy.dry_run
        )
        ds = score_dimension(results, dim.name, dim.weight)
        dimension_scores.append(ds)

        for result in ds.results:
            status = "\u2705 PASS" if result.passed else "\u274c FAIL"
            hard = " [HARD GATE]" if result.hard_gate else ""
            tier_label = f" [{result.tier.value}]" if tier_filter else ""
            print(f"   - {result.metric_name}: {status}{hard}{tier_label}")

            if not result.passed and (policy.verbose or result.hard_gate):
                if result.output:
                    lines = result.output.strip().split("\n")
                    for line in lines[:10]:
                        print(f"     > {line}")
                    if len(lines) > 10:
                        print(f"     > ... ({len(lines) - 10} more lines)")

        if ds.total > 0:
            print(f"   Score: {ds.score:.0f}%")

    report = score_report(dimension_scores, min_score=policy.min_score)
    reporter.print_footer(report)

    return enforce(report, policy)


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate that dimension weights sum to 100%."""
    project_root = _find_project_root()
    fitness_dir = _find_fitness_dir(project_root)

    dimensions = load_dimensions(fitness_dir)
    valid, total = validate_weights(dimensions)

    for dim in dimensions:
        print(f"  {dim.name}: {dim.weight}%  ({dim.source_file})")

    print(f"\nTotal: {total}%")
    if valid:
        print("\u2705 Weights sum to 100%")
        return 0
    else:
        print(f"\u274c Weights sum to {total}%, expected 100%")
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="routa-fitness",
        description="Evolutionary architecture fitness engine for Routa",
    )
    subparsers = parser.add_subparsers(dest="command")

    # run
    run_parser = subparsers.add_parser("run", help="Run fitness checks")
    run_parser.add_argument(
        "--tier", choices=["fast", "normal", "deep"], help="Run only metrics up to this tier"
    )
    run_parser.add_argument("--parallel", action="store_true", help="Run metrics in parallel")
    run_parser.add_argument("--dry-run", action="store_true", help="Show what would run")
    run_parser.add_argument("--verbose", action="store_true", help="Show output on failure")
    run_parser.set_defaults(func=cmd_run)

    # validate
    validate_parser = subparsers.add_parser("validate", help="Check dimension weights sum to 100%")
    validate_parser.set_defaults(func=cmd_validate)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    exit_code = args.func(args)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
