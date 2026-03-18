"""Change impact analysis — blast radius computation via code graph."""

from __future__ import annotations

import subprocess
from pathlib import Path

CODE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".rs", ".py", ".go",
    ".java", ".kt", ".swift", ".php", ".c", ".cpp",
}


def git_changed_files(repo_root: Path, base: str = "HEAD") -> list[str]:
    """Collect changed, unstaged, and untracked code files relative to base.

    Deduplicates and returns relative paths.
    """
    files: list[str] = []

    # Committed changes vs base
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACMR", base, "--", "src", "apps", "crates"],
        cwd=repo_root, capture_output=True, text=True, check=False,
    )
    files.extend(line.strip() for line in result.stdout.splitlines() if line.strip())

    # Unstaged changes
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACMR", "--", "src", "apps", "crates"],
        cwd=repo_root, capture_output=True, text=True, check=False,
    )
    files.extend(line.strip() for line in result.stdout.splitlines() if line.strip())

    # Untracked files
    result = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "src", "apps", "crates"],
        cwd=repo_root, capture_output=True, text=True, check=False,
    )
    files.extend(line.strip() for line in result.stdout.splitlines() if line.strip())

    # Deduplicate preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for f in files:
        if f not in seen:
            seen.add(f)
            deduped.append(f)
    return deduped


def filter_code_files(files: list[str], repo_root: Path) -> list[str]:
    """Keep only files with recognized code extensions that exist on disk."""
    return [
        f for f in files
        if Path(f).suffix.lower() in CODE_EXTENSIONS and (repo_root / f).exists()
    ]


def classify_test_file(file_path: str) -> bool:
    """Heuristic: is this file a test file?"""
    lowered = file_path.lower()
    return (
        "/tests/" in lowered
        or "/__tests__/" in lowered
        or ".test." in lowered
        or ".spec." in lowered
        or lowered.endswith("_test.rs")
    )
