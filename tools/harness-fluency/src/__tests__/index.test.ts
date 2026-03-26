import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateHarnessFluency,
  formatTextReport,
  loadFluencyModel,
  parseArgs,
} from "../index.js";

function writeJson(targetPath: string, value: unknown): void {
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("loadFluencyModel", () => {
  it("loads the production model and enforces at least two criteria per cell", async () => {
    const model = await loadFluencyModel(
      path.resolve(process.cwd(), "docs/fitness/harness-fluency.model.yaml"),
    );

    expect(model.levels).toHaveLength(5);
    expect(model.dimensions).toHaveLength(5);
    expect(model.criteria).toHaveLength(50);

    for (const level of model.levels) {
      for (const dimension of model.dimensions) {
        const criteria = model.criteria.filter(
          (criterion) => criterion.level === level.id && criterion.dimension === dimension.id,
        );
        expect(criteria.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("parseArgs", () => {
  it("accepts repo-root and json aliases", () => {
    const options = parseArgs(["--repo-root", "/tmp/repo", "--json", "--compare-last", "--no-save"]);

    expect(options.repoRoot).toBe("/tmp/repo");
    expect(options.format).toBe("json");
    expect(options.compareLast).toBe(true);
    expect(options.save).toBe(false);
    expect(options.modelPath).toBe("/tmp/repo/docs/fitness/harness-fluency.model.yaml");
  });
});

describe("evaluateHarnessFluency", () => {
  it("evaluates a small repo, persists snapshots, and compares against the last run", async () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), "harness-fluency-"));
    mkdirSync(path.join(repoRoot, "docs", "fitness"), { recursive: true });
    mkdirSync(path.join(repoRoot, ".github", "workflows"), { recursive: true });

    const modelPath = path.join(repoRoot, "docs", "fitness", "model.yaml");
    const snapshotPath = path.join(repoRoot, "docs", "fitness", "latest.json");

    writeJson(path.join(repoRoot, "package.json"), {
      scripts: {
        lint: "eslint .",
        "test:run": "vitest run",
      },
    });
    writeFileSync(path.join(repoRoot, "AGENTS.md"), "# contract\n", "utf8");
    writeFileSync(path.join(repoRoot, ".github", "workflows", "guard.yml"), "jobs:\n  build:\n    steps: []\n", "utf8");
    writeFileSync(
      modelPath,
      `version: 1
levels:
  - id: awareness
    name: Awareness
  - id: assisted
    name: Assisted
dimensions:
  - id: collaboration
    name: Collaboration
criteria:
  - id: collaboration.awareness.operating_contract
    level: awareness
    dimension: collaboration
    weight: 1
    critical: true
    why_it_matters: Repo guidance must be durable.
    recommended_action: Add an AGENTS contract.
    evidence_hint: AGENTS.md
    detector:
      type: file_exists
      path: AGENTS.md
  - id: collaboration.awareness.lint_script
    level: awareness
    dimension: collaboration
    weight: 1
    critical: false
    why_it_matters: Teams need a baseline feedback loop.
    recommended_action: Add a lint script.
    evidence_hint: package.json scripts.lint
    detector:
      type: json_path_exists
      path: package.json
      jsonPath: [scripts, lint]
  - id: collaboration.assisted.test_script
    level: assisted
    dimension: collaboration
    weight: 1
    critical: true
    why_it_matters: Assisted flows should verify changes.
    recommended_action: Add a test runner script.
    evidence_hint: package.json scripts.test:run
    detector:
      type: json_path_exists
      path: package.json
      jsonPath: [scripts, "test:run"]
  - id: collaboration.assisted.guard_workflow
    level: assisted
    dimension: collaboration
    weight: 1
    critical: false
    why_it_matters: Assisted flows should surface automation hooks.
    recommended_action: Add a guard workflow.
    evidence_hint: .github/workflows/guard.yml
    detector:
      type: yaml_path_exists
      path: .github/workflows/guard.yml
      yamlPath: [jobs, build, steps]
`,
      "utf8",
    );

    const firstReport = await evaluateHarnessFluency({
      repoRoot,
      modelPath,
      snapshotPath,
      compareLast: true,
      save: true,
    });
    expect(firstReport.overallLevel).toBe("assisted");
    expect(firstReport.comparison).toBeNull();

    const guardWorkflow = path.join(repoRoot, ".github", "workflows", "guard.yml");
    writeFileSync(guardWorkflow, "name: guard\n", "utf8");

    const secondReport = await evaluateHarnessFluency({
      repoRoot,
      modelPath,
      snapshotPath,
      compareLast: true,
      save: false,
    });

    expect(secondReport.overallLevel).toBe("awareness");
    expect(secondReport.comparison?.overallChange).toBe("down");
    expect(secondReport.comparison?.criteriaChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "collaboration.assisted.guard_workflow",
          previousStatus: "pass",
          currentStatus: "fail",
        }),
      ]),
    );

    const textReport = formatTextReport(secondReport);
    expect(textReport).toContain("HARNESS FLUENCY REPORT");
    expect(textReport).toContain("Blocking Gaps To Assisted");
  });
});
