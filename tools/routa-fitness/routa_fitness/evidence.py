"""Evidence loader — parse YAML frontmatter from docs/fitness/*.md into Dimension objects."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from routa_fitness.model import Dimension, Metric, Tier

# Files to skip when scanning the fitness directory
_SKIP_FILES = {"README.md", "REVIEW.md"}


def parse_frontmatter(content: str) -> dict | None:
    """Extract YAML frontmatter from markdown content."""
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return None
    return yaml.safe_load(match.group(1))


def _build_metric(raw: dict) -> Metric:
    """Convert a raw YAML metric dict into a Metric dataclass."""
    tier_str = raw.get("tier", "normal")
    try:
        tier = Tier(tier_str)
    except ValueError:
        tier = Tier.NORMAL

    return Metric(
        name=raw.get("name", "unknown"),
        command=raw.get("command", ""),
        pattern=raw.get("pattern", ""),
        hard_gate=raw.get("hard_gate", False),
        tier=tier,
        description=raw.get("description", ""),
    )


def load_dimensions(fitness_dir: Path) -> list[Dimension]:
    """Scan *.md files in fitness_dir for YAML frontmatter, return Dimension objects.

    Args:
        fitness_dir: Path to the docs/fitness/ directory.

    Returns:
        Sorted list of Dimension objects with their metrics.
    """
    dimensions: list[Dimension] = []

    for md_file in sorted(fitness_dir.glob("*.md")):
        if md_file.name in _SKIP_FILES:
            continue

        content = md_file.read_text(encoding="utf-8")
        fm = parse_frontmatter(content)

        if not fm or "metrics" not in fm:
            continue

        threshold = fm.get("threshold", {})
        metrics = [_build_metric(m) for m in fm.get("metrics", [])]

        dim = Dimension(
            name=fm.get("dimension", "unknown"),
            weight=fm.get("weight", 0),
            threshold_pass=threshold.get("pass", 90),
            threshold_warn=threshold.get("warn", 80),
            metrics=metrics,
            source_file=md_file.name,
        )
        dimensions.append(dim)

    return dimensions


def validate_weights(dimensions: list[Dimension]) -> tuple[bool, int]:
    """Check that dimension weights sum to 100%.

    Returns:
        (valid, total_weight) tuple.
    """
    total = sum(d.weight for d in dimensions)
    return total == 100, total
