"""MCP server — expose fitness functions as tools for AI agent integration."""

from __future__ import annotations

from pathlib import Path


def create_server(project_root: Path | None = None):
    """Create and configure the FastMCP server.

    Requires the [mcp] optional dependency: pip install routa-fitness[mcp]
    """
    try:
        from fastmcp import FastMCP
    except ImportError as e:
        raise ImportError(
            "fastmcp is not installed. Install with: pip install routa-fitness[mcp]"
        ) from e

    if project_root is None:
        project_root = Path.cwd()

    mcp = FastMCP("routa-fitness", instructions="Evolutionary architecture fitness engine")

    @mcp.tool()
    def run_fitness(
        tier: str | None = None,
        parallel: bool = False,
        dry_run: bool = False,
    ) -> dict:
        """Run fitness checks and return a structured report.

        Args:
            tier: Filter by tier (fast, normal, deep). None runs all.
            parallel: Run metrics in parallel.
            dry_run: Show what would run without executing.
        """
        from routa_fitness.evidence import load_dimensions
        from routa_fitness.governance import GovernancePolicy, filter_dimensions
        from routa_fitness.model import Tier
        from routa_fitness.runners.shell import ShellRunner
        from routa_fitness.scoring import score_dimension, score_report

        fitness_dir = project_root / "docs" / "fitness"
        tier_filter = Tier(tier) if tier else None
        policy = GovernancePolicy(tier_filter=tier_filter, parallel=parallel, dry_run=dry_run)

        dimensions = filter_dimensions(load_dimensions(fitness_dir), policy)
        runner = ShellRunner(project_root)

        dim_scores = []
        for dim in dimensions:
            results = runner.run_batch(dim.metrics, parallel=parallel, dry_run=dry_run)
            dim_scores.append(score_dimension(results, dim.name, dim.weight))

        report = score_report(dim_scores)
        return {
            "final_score": report.final_score,
            "hard_gate_blocked": report.hard_gate_blocked,
            "score_blocked": report.score_blocked,
            "dimensions": [
                {
                    "name": ds.dimension,
                    "weight": ds.weight,
                    "score": ds.score,
                    "passed": ds.passed,
                    "total": ds.total,
                    "hard_gate_failures": ds.hard_gate_failures,
                }
                for ds in report.dimensions
            ],
        }

    @mcp.tool()
    def get_dimension_status(dimension: str) -> dict:
        """Get current status of a specific fitness dimension.

        Args:
            dimension: Dimension name (e.g. 'code_quality', 'security').
        """
        from routa_fitness.evidence import load_dimensions
        from routa_fitness.runners.shell import ShellRunner
        from routa_fitness.scoring import score_dimension

        fitness_dir = project_root / "docs" / "fitness"
        dimensions = load_dimensions(fitness_dir)
        runner = ShellRunner(project_root)

        for dim in dimensions:
            if dim.name == dimension:
                results = runner.run_batch(dim.metrics)
                ds = score_dimension(results, dim.name, dim.weight)
                return {
                    "name": ds.dimension,
                    "weight": ds.weight,
                    "score": ds.score,
                    "passed": ds.passed,
                    "total": ds.total,
                    "hard_gate_failures": ds.hard_gate_failures,
                    "results": [
                        {"name": r.metric_name, "passed": r.passed, "tier": r.tier.value}
                        for r in ds.results
                    ],
                }

        return {"error": f"Dimension '{dimension}' not found"}

    @mcp.tool()
    def analyze_change_impact(
        changed_files: list[str] | None = None,
        depth: int = 2,
        base: str = "HEAD",
    ) -> dict:
        """Analyze blast radius of changes using the code graph.

        Requires an available graph backend.

        Args:
            changed_files: Explicit list of files, or None to auto-detect via git.
            depth: BFS traversal depth for impact analysis.
            base: Git ref to diff against.
        """
        from routa_fitness.runners.graph import GraphRunner

        runner = GraphRunner(project_root)
        if not runner.available:
            return {"status": "unavailable", "reason": "graph backend unavailable"}

        result = runner.probe_impact(base=base, max_depth=depth)
        return {
            "status": "ok",
            "passed": result.passed,
            "output": result.output,
        }

    return mcp


def main() -> None:
    """Entry point for `routa-fitness serve`."""
    server = create_server()
    server.run(transport="stdio")
