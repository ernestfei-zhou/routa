import { describe, expect, it } from "vitest";

import { buildFitnessOverviewCanvasData } from "../fitness-canvas-data";
import type { FitnessReport } from "../fitness-analysis-types";

const report: FitnessReport = {
  modelVersion: 1,
  modelPath: "docs/fitness/harness-fluency.model.yaml",
  profile: "generic",
  framing: "fluency",
  mode: "deterministic",
  repoRoot: "/tmp/repo",
  generatedAt: "2026-04-17T10:00:00.000Z",
  snapshotPath: "/tmp/report.json",
  overallLevel: "agent_centric",
  overallLevelName: "Agent-Centric",
  currentLevelReadiness: 0.84,
  nextLevel: "agent_first",
  nextLevelName: "Agent-First",
  dimensions: {
    governance: {
      dimension: "governance",
      name: "Governance",
      level: "agent_centric",
      levelName: "Agent-Centric",
      levelIndex: 3,
      score: 0.82,
      nextLevel: "agent_first",
      nextLevelName: "Agent-First",
      nextLevelProgress: 0.4,
    },
  },
  capabilityGroups: {},
  evidencePacks: [],
  cells: [],
  criteria: [],
  blockingCriteria: [
    {
      id: "governance.agent_first.machine_readable_guardrails",
      level: "agent_first",
      dimension: "governance",
      weight: 5,
      critical: true,
      status: "fail",
      detectorType: "rule",
      detail: "CODEOWNERS is missing",
      evidence: [],
      whyItMatters: "Guardrails keep ownership explicit.",
      recommendedAction: "Add CODEOWNERS coverage for critical paths.",
      evidenceHint: "Inspect CODEOWNERS and review triggers.",
    },
  ],
  recommendations: [
    {
      criterionId: "governance.agent_first.machine_readable_guardrails",
      action: "Add CODEOWNERS coverage",
      whyItMatters: "Guardrails keep ownership explicit.",
      evidenceHint: "Inspect CODEOWNERS and review triggers.",
      critical: true,
      weight: 5,
    },
  ],
  comparison: {
    previousGeneratedAt: "2026-04-16T10:00:00.000Z",
    previousOverallLevel: "structured_ai_coding",
    overallChange: "up",
    dimensionChanges: [
      {
        dimension: "governance",
        previousLevel: "structured_ai_coding",
        currentLevel: "agent_centric",
        change: "up",
      },
    ],
    criteriaChanges: [],
  },
};

describe("buildFitnessOverviewCanvasData", () => {
  it("maps a fluency report into the prebuilt canvas payload", () => {
    const canvasData = buildFitnessOverviewCanvasData(report);

    expect(canvasData).toMatchObject({
      generatedAt: "2026-04-17T10:00:00.000Z",
      profile: "Generic",
      overallLevel: "agent_centric",
      overallLevelName: "Agent-Centric",
      currentLevelReadiness: 0.84,
      nextLevel: "agent_first",
      nextLevelName: "Agent-First",
      recommendations: [
        {
          criterionId: "governance.agent_first.machine_readable_guardrails",
          action: "Add CODEOWNERS coverage",
          critical: true,
        },
      ],
      blockingCriteria: [
        {
          id: "governance.agent_first.machine_readable_guardrails",
          title: "Machine Readable Guardrails",
          reason: "Add CODEOWNERS coverage for critical paths.",
        },
      ],
      comparison: {
        previousGeneratedAt: "2026-04-16T10:00:00.000Z",
        previousOverallLevel: "structured_ai_coding",
        overallChange: "up",
      },
    });

    expect(canvasData.dimensions.governance).toMatchObject({
      dimension: "governance",
      name: "Governance",
      levelName: "Agent-Centric",
      score: 0.82,
      nextLevelProgress: 0.4,
    });
  });
});
