"""Tests for routa_fitness.model."""

from routa_fitness.model import (
    AnalysisMode,
    Dimension,
    DimensionScore,
    FitnessKind,
    FitnessReport,
    Metric,
    MetricResult,
    Tier,
)


def test_tier_order():
    assert Tier.order(Tier.FAST) < Tier.order(Tier.NORMAL) < Tier.order(Tier.DEEP)


def test_tier_values():
    assert Tier.FAST.value == "fast"
    assert Tier.NORMAL.value == "normal"
    assert Tier.DEEP.value == "deep"


def test_metric_defaults():
    m = Metric(name="lint", command="npm run lint")
    assert m.pattern == ""
    assert m.hard_gate is False
    assert m.tier == Tier.NORMAL
    assert m.kind == FitnessKind.ATOMIC
    assert m.analysis == AnalysisMode.STATIC


def test_dimension_defaults():
    d = Dimension(name="security", weight=20)
    assert d.threshold_pass == 90
    assert d.threshold_warn == 80
    assert d.metrics == []
    assert d.source_file == ""


def test_metric_result():
    r = MetricResult(metric_name="lint", passed=True, output="ok", tier=Tier.FAST)
    assert r.hard_gate is False
    assert r.duration_ms == 0.0


def test_dimension_score():
    ds = DimensionScore(dimension="security", weight=20, passed=3, total=4, score=75.0)
    assert ds.hard_gate_failures == []
    assert ds.results == []


def test_fitness_report_defaults():
    r = FitnessReport()
    assert r.dimensions == []
    assert r.final_score == 0.0
    assert r.hard_gate_blocked is False
    assert r.score_blocked is False
