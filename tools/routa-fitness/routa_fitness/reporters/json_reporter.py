"""JSON reporter — machine-readable output for CI pipelines."""

from __future__ import annotations

import json
import sys
from dataclasses import asdict

from routa_fitness.model import FitnessReport


class JsonReporter:
    """Outputs fitness report as JSON to stdout or a file."""

    def report(self, report: FitnessReport, *, file=None) -> None:
        """Serialize the fitness report to JSON.

        Args:
            report: The fitness report to serialize.
            file: File-like object to write to (defaults to stdout).
        """
        out = file or sys.stdout
        data = asdict(report)
        # Convert Tier enums to strings
        for dim in data.get("dimensions", []):
            for result in dim.get("results", []):
                if hasattr(result.get("tier"), "value"):
                    result["tier"] = result["tier"].value
        json.dump(data, out, indent=2, default=str)
        out.write("\n")
