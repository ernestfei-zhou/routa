"""Tests for routa_fitness.cli."""

from routa_fitness.cli import build_parser


def test_parser_run_defaults():
    parser = build_parser()
    args = parser.parse_args(["run"])
    assert args.command == "run"
    assert args.tier is None
    assert args.parallel is False
    assert args.dry_run is False
    assert args.verbose is False


def test_parser_run_all_flags():
    parser = build_parser()
    args = parser.parse_args(["run", "--tier", "fast", "--parallel", "--dry-run", "--verbose"])
    assert args.tier == "fast"
    assert args.parallel is True
    assert args.dry_run is True
    assert args.verbose is True


def test_parser_validate():
    parser = build_parser()
    args = parser.parse_args(["validate"])
    assert args.command == "validate"


def test_parser_no_command():
    parser = build_parser()
    args = parser.parse_args([])
    assert args.command is None
