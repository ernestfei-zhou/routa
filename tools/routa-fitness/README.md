# Routa

**Guardrails Embedded in the Change Lifecycle**

`routa-fitness` is the Python package behind Routa's fitness and review-trigger workflow.
It is designed to keep architectural checks close to the change lifecycle instead of treating them as an afterthought at the end of CI.

## The Idea

Routa treats quality control as a staged guardrail flow:

```text
The further to the right, the higher the fix cost,
the lower the certainty of automation,
and the more human judgment is required.

[Requirements / AI-generated change]
        |
        v
[Rule Definition] -> [Baseline Quality Gates] -> [Risk Identification & Routing] -> [Deep Validation] -> [Release & Feedback]
     |                      |                           |                             |                        |
     |                      |                           |                             |                        |
     |- metrics?            |- compile?                |- API/schema?                |- API parity?          |- merge / release
     |- thresholds?         |- lint?                   |- impact radius?             |- E2E / visual?        |- write back rules
     |- hard gates?         |- tests?                  |- suspicious expansion?      |- semgrep / audit?     |- adjust thresholds
     |- evidence?           |- coverage?               |- missing evidence?          |- need human review?   |- close the loop
```

Outcomes:

- Pass: continue to review, PR, merge, and release
- Warn: strengthen evidence or escalate review depth
- Block: do not merge

Under the flow:

```text
docs/fitness  ->  routa-fitness orchestration  ->  hard gates + weighted score + review triggers
```

Feedback loop:

```text
Production issue / missed detection
    -> update docs/fitness
    -> tune thresholds
    -> add or refine verification templates
```

## What the Package Does

Today the package provides:

- architecture fitness checks grouped by dimension
- fast / normal / deep execution tiers
- change-aware execution for the current git diff
- hard-gate and weighted-score orchestration
- review triggers that explicitly ask for human intervention on risky changes

This makes Routa useful both as:

- a repository-local fitness runner
- a reusable base for a more general fitness engine

## Install

Install from PyPI:

```bash
pip install routa-fitness
```

For development inside the Routa repository:

```bash
pip install -e tools/routa-fitness
```

## CLI

```bash
routa-fitness run --tier fast
routa-fitness run --changed-only --base HEAD~1
routa-fitness validate
routa-fitness review-trigger --base HEAD~1
```

## Fitness Specs

By default, `routa-fitness run` loads executable fitness specs from:

```text
docs/fitness/*.md
```

Each spec file uses YAML frontmatter to declare a dimension and its metrics.

Minimal example:

```yaml
---
dimension: code_quality
weight: 20
threshold:
  pass: 90
  warn: 80
metrics:
  - name: lint
    command: npm run lint 2>&1
    hard_gate: true
    tier: fast
---
```

## Review Triggers

`review-trigger` is intentionally different from score-based fitness metrics.

- a normal metric answers: "did the automated check pass?"
- a review trigger answers: "is this change still safe to trust to automation alone?"

By default, review triggers are loaded from:

```text
docs/fitness/review-triggers.yaml
```

Minimal example:

```yaml
review_triggers:
  - name: high_risk_directory_change
    type: changed_paths
    paths:
      - src/core/acp/**
    severity: high
    action: require_human_review
```

Example output:

```json
{
  "human_review_required": true,
  "triggers": [
    {
      "name": "high_risk_directory_change",
      "severity": "high",
      "reasons": [
        "changed path: src/core/acp/..."
      ]
    }
  ]
}
```

## Python API

```python
from pathlib import Path

from routa_fitness.review_trigger import (
    collect_changed_files,
    collect_diff_stats,
    evaluate_review_triggers,
    load_review_triggers,
)

repo_root = Path(".").resolve()
rules = load_review_triggers(repo_root / "docs" / "fitness" / "review-triggers.yaml")
changed_files = collect_changed_files(repo_root, "HEAD~1")
diff_stats = collect_diff_stats(repo_root, "HEAD~1")
report = evaluate_review_triggers(rules, changed_files, diff_stats, base="HEAD~1")
print(report.to_dict())
```

## Status

Current status:

- stable for Routa-internal usage
- ready to publish as a standalone PyPI package
- evolving toward a reusable core / adapter / preset architecture
