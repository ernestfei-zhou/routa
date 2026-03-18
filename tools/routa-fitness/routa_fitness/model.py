"""Domain model for evolutionary architecture fitness functions.

Aligns with concepts from "Building Evolutionary Architectures":
- Fitness Function → Metric (an executable architectural check)
- Dimension → architectural characteristic category
- Atomic vs Holistic → FitnessKind
- Static vs Dynamic → AnalysisMode
- Triggered vs Continuous → Tier (execution frequency)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Tier(Enum):
    """Execution speed tier — maps to trigger frequency."""

    FAST = "fast"  # <30s: lints, static analysis
    NORMAL = "normal"  # <5min: unit tests, contract checks
    DEEP = "deep"  # <15min: E2E, security scans

    @staticmethod
    def order(tier: Tier) -> int:
        return {"fast": 0, "normal": 1, "deep": 2}[tier.value]


class FitnessKind(Enum):
    """Atomic checks one thing; holistic checks system-wide properties."""

    ATOMIC = "atomic"
    HOLISTIC = "holistic"


class AnalysisMode(Enum):
    """Static analyzes code structure; dynamic analyzes runtime behavior."""

    STATIC = "static"
    DYNAMIC = "dynamic"


@dataclass
class Metric:
    """A single executable fitness function."""

    name: str
    command: str
    pattern: str = ""
    hard_gate: bool = False
    tier: Tier = Tier.NORMAL
    description: str = ""
    kind: FitnessKind = FitnessKind.ATOMIC
    analysis: AnalysisMode = AnalysisMode.STATIC


@dataclass
class Dimension:
    """An architectural characteristic being measured (e.g. security, evolvability)."""

    name: str
    weight: int  # percentage, all dimensions should sum to 100
    threshold_pass: int = 90
    threshold_warn: int = 80
    metrics: list[Metric] = field(default_factory=list)
    source_file: str = ""


@dataclass
class MetricResult:
    """Outcome of executing a single Metric."""

    metric_name: str
    passed: bool
    output: str
    tier: Tier
    hard_gate: bool = False
    duration_ms: float = 0.0


@dataclass
class DimensionScore:
    """Aggregated score for one Dimension."""

    dimension: str
    weight: int
    passed: int
    total: int
    score: float  # 0-100
    hard_gate_failures: list[str] = field(default_factory=list)
    results: list[MetricResult] = field(default_factory=list)


@dataclass
class FitnessReport:
    """Final report across all dimensions."""

    dimensions: list[DimensionScore] = field(default_factory=list)
    final_score: float = 0.0
    hard_gate_blocked: bool = False
    score_blocked: bool = False  # final_score < threshold
