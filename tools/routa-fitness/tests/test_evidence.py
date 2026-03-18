"""Tests for routa_fitness.evidence."""

import textwrap
from pathlib import Path

from routa_fitness.evidence import load_dimensions, parse_frontmatter, validate_weights
from routa_fitness.model import Tier


def test_parse_frontmatter_valid():
    content = textwrap.dedent("""\
        ---
        dimension: testability
        weight: 20
        metrics:
          - name: ts_test
            command: npm run test
        ---
        # Body
    """)
    fm = parse_frontmatter(content)
    assert fm is not None
    assert fm["dimension"] == "testability"
    assert fm["weight"] == 20
    assert len(fm["metrics"]) == 1


def test_parse_frontmatter_missing():
    assert parse_frontmatter("# No frontmatter here") is None


def test_parse_frontmatter_empty_yaml():
    content = "---\n---\n# Empty"
    fm = parse_frontmatter(content)
    assert fm is None  # yaml.safe_load returns None for empty


def test_load_dimensions(tmp_path: Path):
    md = tmp_path / "security.md"
    md.write_text(textwrap.dedent("""\
        ---
        dimension: security
        weight: 20
        threshold:
          pass: 90
          warn: 75
        metrics:
          - name: npm_audit
            command: npm audit
            hard_gate: true
            tier: fast
          - name: cargo_audit
            command: cargo audit
        ---
        # Security evidence
    """))

    dims = load_dimensions(tmp_path)
    assert len(dims) == 1
    dim = dims[0]
    assert dim.name == "security"
    assert dim.weight == 20
    assert dim.threshold_pass == 90
    assert dim.threshold_warn == 75
    assert len(dim.metrics) == 2
    assert dim.metrics[0].hard_gate is True
    assert dim.metrics[0].tier == Tier.FAST
    assert dim.metrics[1].tier == Tier.NORMAL
    assert dim.source_file == "security.md"


def test_load_dimensions_skips_readme(tmp_path: Path):
    (tmp_path / "README.md").write_text("---\ndimension: x\nweight: 10\nmetrics:\n  - name: y\n    command: z\n---\n")
    dims = load_dimensions(tmp_path)
    assert len(dims) == 0


def test_load_dimensions_skips_no_frontmatter(tmp_path: Path):
    (tmp_path / "notes.md").write_text("# Just notes\nNo frontmatter here.")
    dims = load_dimensions(tmp_path)
    assert len(dims) == 0


def test_validate_weights():
    from routa_fitness.model import Dimension

    dims = [
        Dimension(name="a", weight=60),
        Dimension(name="b", weight=40),
    ]
    valid, total = validate_weights(dims)
    assert valid is True
    assert total == 100


def test_validate_weights_fail():
    from routa_fitness.model import Dimension

    dims = [Dimension(name="a", weight=50)]
    valid, total = validate_weights(dims)
    assert valid is False
    assert total == 50
