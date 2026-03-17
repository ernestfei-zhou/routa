#!/usr/bin/env python3
"""
Fitness Function Runner

Scans docs/fitness/*.md files, parses YAML frontmatter,
executes metrics commands, and outputs results to terminal.

Usage:
    python3 docs/fitness/scripts/fitness.py [OPTIONS]

Options:
    --dry-run       Show what would be executed without running
    --verbose       Show command output on failure
    --tier TIER     Run only metrics of specified tier (fast|normal|deep)
    --parallel      Run metrics in parallel (default: serial)
    --help          Show this help message

Tiers:
    fast    - Quick checks (<30s total): lints, static analysis
    normal  - Standard checks (<5min total): unit tests, contract checks
    deep    - Comprehensive checks (<15min total): E2E, security scans
"""

import re
import subprocess
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[3]

def parse_frontmatter(content: str) -> dict | None:
    """Extract YAML frontmatter from markdown content."""
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return None
    return yaml.safe_load(match.group(1))

def run_metric(metric: dict, dry_run: bool = False, verbose: bool = False) -> tuple[str, bool, str, str]:
    """Run a single metric command and check result.

    Returns: (name, passed, output, tier)
    """
    name = metric.get('name', 'unknown')
    command = metric.get('command', '')
    pattern = metric.get('pattern', '')
    tier = metric.get('tier', 'normal')

    if dry_run:
        return name, True, f"[DRY-RUN] Would run: {command}", tier

    try:
        result = subprocess.run(
            ["/bin/bash", "-lc", command],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=PROJECT_ROOT,
        )
        output = result.stdout + result.stderr

        if pattern:
            passed = bool(re.search(pattern, output, re.IGNORECASE))
        else:
            passed = result.returncode == 0

        # Return more output in verbose mode
        max_len = 2000 if verbose else 500
        return name, passed, output[:max_len], tier
    except subprocess.TimeoutExpired:
        return name, False, "TIMEOUT (300s)", tier
    except Exception as e:
        return name, False, str(e), tier

def print_help():
    print(__doc__)
    sys.exit(0)

def should_run_metric(metric: dict, tier_filter: Optional[str]) -> bool:
    """Check if metric should run based on tier filter."""
    if not tier_filter:
        return True

    metric_tier = metric.get('tier', 'normal')

    # Tier hierarchy: fast < normal < deep
    tier_order = {'fast': 0, 'normal': 1, 'deep': 2}
    filter_level = tier_order.get(tier_filter, 1)
    metric_level = tier_order.get(metric_tier, 1)

    return metric_level <= filter_level

def main():
    if '--help' in sys.argv:
        print_help()

    dry_run = '--dry-run' in sys.argv
    verbose = '--verbose' in sys.argv
    use_parallel = '--parallel' in sys.argv

    # Parse tier filter
    tier_filter = None
    for i, arg in enumerate(sys.argv):
        if arg == '--tier' and i + 1 < len(sys.argv):
            tier_filter = sys.argv[i + 1]
            if tier_filter not in ['fast', 'normal', 'deep']:
                print(f"Error: Invalid tier '{tier_filter}'. Must be fast, normal, or deep.")
                sys.exit(1)

    fitness_dir = Path(__file__).parent.parent

    print("=" * 60)
    print("FITNESS FUNCTION REPORT")
    if dry_run:
        print("(DRY-RUN MODE)")
    if tier_filter:
        print(f"(TIER: {tier_filter.upper()})")
    if use_parallel:
        print("(PARALLEL MODE)")
    print("=" * 60)

    total_score = 0
    total_weight = 0
    hard_gate_failed = []

    for md_file in sorted(fitness_dir.glob('*.md')):
        if md_file.name == 'README.md' or md_file.name == 'REVIEW.md':
            continue

        content = md_file.read_text()
        fm = parse_frontmatter(content)

        if not fm or 'metrics' not in fm:
            continue

        dimension = fm.get('dimension', 'unknown')
        weight = fm.get('weight', 0)

        # Filter metrics by tier
        metrics_to_run = [m for m in fm.get('metrics', []) if should_run_metric(m, tier_filter)]

        if not metrics_to_run:
            continue

        print(f"\n## {dimension.upper()} (weight: {weight}%)")
        print(f"   Source: {md_file.name}")

        dim_passed = 0
        dim_total = 0

        # Run metrics (parallel or serial)
        if use_parallel and not dry_run:
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = {executor.submit(run_metric, m, dry_run, verbose): m for m in metrics_to_run}
                results = []
                for future in as_completed(futures):
                    metric = futures[future]
                    name, passed, output, tier = future.result()
                    results.append((metric, name, passed, output, tier))

                # Sort results by original order
                metric_order = {id(m): i for i, m in enumerate(metrics_to_run)}
                results.sort(key=lambda x: metric_order.get(id(x[0]), 999))

                for metric, name, passed, output, tier in results:
                    status = "✅ PASS" if passed else "❌ FAIL"
                    hard = " [HARD GATE]" if metric.get('hard_gate') else ""
                    tier_label = f" [{tier}]" if tier_filter else ""

                    print(f"   - {name}: {status}{hard}{tier_label}")

                    if not passed and (verbose or metric.get('hard_gate')):
                        print(f"     Command: {metric.get('command', '')}")
                        if output and output != "TIMEOUT (300s)":
                            for line in output.strip().split('\n')[:10]:
                                print(f"     > {line}")
                            if output.count('\n') > 10:
                                print(f"     > ... ({output.count(chr(10)) - 10} more lines)")

                    if not passed and metric.get('hard_gate'):
                        hard_gate_failed.append(name)

                    dim_passed += 1 if passed else 0
                    dim_total += 1
        else:
            # Serial execution
            for metric in metrics_to_run:
                name, passed, output, tier = run_metric(metric, dry_run, verbose)
                status = "✅ PASS" if passed else "❌ FAIL"
                hard = " [HARD GATE]" if metric.get('hard_gate') else ""
                tier_label = f" [{tier}]" if tier_filter else ""

                print(f"   - {name}: {status}{hard}{tier_label}")

                if not passed and (verbose or metric.get('hard_gate')):
                    print(f"     Command: {metric.get('command', '')}")
                    if output and output != "TIMEOUT (300s)":
                        for line in output.strip().split('\n')[:10]:
                            print(f"     > {line}")
                        if output.count('\n') > 10:
                            print(f"     > ... ({output.count(chr(10)) - 10} more lines)")

                if not passed and metric.get('hard_gate'):
                    hard_gate_failed.append(name)

                dim_passed += 1 if passed else 0
                dim_total += 1

        if dim_total > 0:
            dim_score = (dim_passed / dim_total) * 100
            total_score += dim_score * weight
            total_weight += weight
            print(f"   Score: {dim_score:.0f}%")

    print("\n" + "=" * 60)

    if hard_gate_failed:
        print(f"❌ HARD GATES FAILED: {', '.join(hard_gate_failed)}")
        print("   Cannot proceed until hard gates pass.")
        sys.exit(2)

    if total_weight > 0:
        final_score = total_score / total_weight
        print(f"FINAL SCORE: {final_score:.1f}%")

        if final_score >= 90:
            print("✅ PASS")
        elif final_score >= 80:
            print("⚠️  WARN - Consider improvements")
        else:
            print("❌ BLOCK - Score too low")
            sys.exit(1)

    print("=" * 60)

if __name__ == '__main__':
    main()
