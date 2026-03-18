"""Adapter wrapping code-review-graph as a StructuralAnalyzer.

code-review-graph is an optional dependency. This adapter handles:
- Lazy import (only when actually used)
- ROUTA_CODE_REVIEW_GRAPH_SOURCE env for local dev
- Graceful error reporting when not installed
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


class CodeReviewGraphAdapter:
    """Wraps code_review_graph as a StructuralAnalyzer implementation."""

    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self._tools = None

    def _ensure_loaded(self) -> None:
        """Lazy-load code_review_graph, respecting ROUTA_CODE_REVIEW_GRAPH_SOURCE."""
        if self._tools is not None:
            return

        source = os.environ.get("ROUTA_CODE_REVIEW_GRAPH_SOURCE")
        if source:
            sys.path.insert(0, source)

        try:
            from code_review_graph import tools as crg_tools
            self._tools = crg_tools
        except ImportError as e:
            raise ImportError(
                "code-review-graph is not installed. "
                "Install with: pip install routa-fitness[graph]"
            ) from e

    def build_or_update(self, *, full: bool = False, base: str = "HEAD~1") -> dict:
        self._ensure_loaded()
        return self._tools.build_or_update_graph(
            repo_root=str(self.repo_root),
            base=base,
            full_rebuild=full,
        )

    def impact_radius(self, files: list[str], *, depth: int = 2) -> dict:
        self._ensure_loaded()
        return self._tools.get_impact_radius(
            changed_files=files,
            max_depth=depth,
            repo_root=str(self.repo_root),
        )

    def query(self, query_type: str, target: str) -> dict:
        self._ensure_loaded()
        return self._tools.query_graph(
            query_type=query_type,
            target=target,
            repo_root=str(self.repo_root),
        )

    def stats(self) -> dict:
        self._ensure_loaded()
        return self._tools.list_graph_stats(repo_root=str(self.repo_root))


def try_create_adapter(repo_root: Path) -> CodeReviewGraphAdapter | None:
    """Attempt to create an adapter, returning None if code-review-graph is unavailable."""
    adapter = CodeReviewGraphAdapter(repo_root)
    try:
        adapter._ensure_loaded()
        return adapter
    except ImportError:
        return None
