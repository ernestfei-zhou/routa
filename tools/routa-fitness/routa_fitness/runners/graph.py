"""Graph runner — execute graph-backed fitness probes via the StructuralAnalyzer."""

from __future__ import annotations

from pathlib import Path

from routa_fitness.model import MetricResult, Tier
from routa_fitness.structure.adapter import try_create_adapter
from routa_fitness.structure.impact import (
    classify_test_file,
    filter_code_files,
    git_changed_files,
)


class GraphRunner:
    """Runs fitness probes backed by the code graph.

    Gracefully skips when code-review-graph is not installed.
    """

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self._adapter = try_create_adapter(project_root)

    @property
    def available(self) -> bool:
        return self._adapter is not None

    def probe_impact(
        self,
        *,
        base: str = "HEAD",
        max_depth: int = 2,
        max_impacted_files: int = 200,
        build_mode: str = "auto",
        require_graph: bool = False,
    ) -> MetricResult:
        """Run blast-radius analysis and return a structured MetricResult.

        When code-review-graph is unavailable and require_graph is False,
        returns a passing "skipped" result.
        """
        if not self.available:
            if require_graph:
                return MetricResult(
                    metric_name="graph_probe",
                    passed=False,
                    output="graph_probe_status: blocked import_error=ImportError",
                    tier=Tier.NORMAL,
                )
            return MetricResult(
                metric_name="graph_probe",
                passed=True,
                output="graph_probe_status: skipped reason=import_error",
                tier=Tier.NORMAL,
            )

        changed = filter_code_files(git_changed_files(self.project_root, base), self.project_root)
        if not changed:
            return MetricResult(
                metric_name="graph_probe",
                passed=True,
                output="graph_probe_status: ok\ngraph_changed_files: 0\ngraph_impacted_files: 0",
                tier=Tier.NORMAL,
            )

        try:
            full = build_mode == "full" or not (
                self.project_root / ".code-review-graph" / "graph.db"
            ).exists()
            self._adapter.build_or_update(full=full, base=base)
            impact = self._adapter.impact_radius(changed, depth=max_depth)
        except Exception as exc:
            if require_graph:
                return MetricResult(
                    metric_name="graph_probe",
                    passed=False,
                    output=f"graph_probe_status: blocked runtime_error={type(exc).__name__}",
                    tier=Tier.NORMAL,
                )
            return MetricResult(
                metric_name="graph_probe",
                passed=True,
                output=f"graph_probe_status: skipped reason=runtime_error={type(exc).__name__}",
                tier=Tier.NORMAL,
            )

        impacted_files = impact.get("impacted_files", [])
        impacted_test_files = [p for p in impacted_files if classify_test_file(p)]
        wide = len(impacted_files) > max_impacted_files

        lines = [
            f"graph_probe_status: {impact.get('status', 'ok')}",
            f"graph_changed_files: {len(changed)}",
            f"graph_impacted_files: {len(impacted_files)}",
            f"graph_impacted_test_files: {len(impacted_test_files)}",
            f"graph_wide_blast_radius: {'yes' if wide else 'no'}",
        ]

        return MetricResult(
            metric_name="graph_probe",
            passed=not wide,
            output="\n".join(lines),
            tier=Tier.NORMAL,
        )

    def probe_test_coverage(
        self, changed_files: list[str] | None = None, *, base: str = "HEAD"
    ) -> MetricResult:
        """Check if changed functions have TESTED_BY edges in the graph."""
        if not self.available:
            return MetricResult(
                metric_name="graph_test_coverage",
                passed=True,
                output="graph_test_coverage: skipped (graph unavailable)",
                tier=Tier.NORMAL,
            )

        if changed_files is None:
            changed_files = filter_code_files(
                git_changed_files(self.project_root, base), self.project_root
            )

        if not changed_files:
            return MetricResult(
                metric_name="graph_test_coverage",
                passed=True,
                output="graph_test_coverage: ok (no changed files)",
                tier=Tier.NORMAL,
            )

        try:
            impact = self._adapter.impact_radius(changed_files, depth=1)
            impacted = impact.get("impacted_files", [])
            test_files = [p for p in impacted if classify_test_file(p)]

            return MetricResult(
                metric_name="graph_test_coverage",
                passed=len(test_files) > 0,
                output=(
                    f"graph_test_coverage: {'ok' if test_files else 'warn'}\n"
                    f"changed_files: {len(changed_files)}\n"
                    f"test_files_in_radius: {len(test_files)}"
                ),
                tier=Tier.NORMAL,
            )
        except Exception as exc:
            return MetricResult(
                metric_name="graph_test_coverage",
                passed=True,
                output=f"graph_test_coverage: skipped ({type(exc).__name__})",
                tier=Tier.NORMAL,
            )
