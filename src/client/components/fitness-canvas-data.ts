"use client";

import type { FitnessOverviewData } from "@/client/canvas-sdk/prebuilt/fitness-overview";

import {
  criterionShortLabel,
  humanizeToken,
  type CriterionResult,
  type FitnessReport,
} from "./fitness-analysis-types";

function toBlockingCriterionSummary(criterion: CriterionResult) {
  const reason = criterion.recommendedAction
    || criterion.detail
    || criterion.whyItMatters;

  return {
    id: criterion.id,
    title: criterionShortLabel(criterion.id),
    reason,
  };
}

export function buildFitnessOverviewCanvasData(
  report: FitnessReport,
): FitnessOverviewData {
  return {
    generatedAt: report.generatedAt,
    profile: humanizeToken(report.profile),
    overallLevel: report.overallLevel,
    overallLevelName: report.overallLevelName,
    currentLevelReadiness: report.currentLevelReadiness,
    nextLevel: report.nextLevel ?? null,
    nextLevelName: report.nextLevelName ?? null,
    dimensions: Object.fromEntries(
      Object.entries(report.dimensions).map(([dimension, value]) => [
        dimension,
        {
          dimension: value.dimension,
          name: value.name,
          level: value.level,
          levelName: value.levelName,
          score: value.score,
          nextLevel: value.nextLevel ?? null,
          nextLevelName: value.nextLevelName ?? null,
          nextLevelProgress: value.nextLevelProgress ?? null,
        },
      ]),
    ),
    recommendations: report.recommendations.map((recommendation) => ({
      criterionId: recommendation.criterionId,
      action: recommendation.action,
      whyItMatters: recommendation.whyItMatters,
      critical: recommendation.critical,
    })),
    blockingCriteria: (report.blockingCriteria ?? []).map(
      toBlockingCriterionSummary,
    ),
    comparison: report.comparison
      ? {
          previousGeneratedAt: report.comparison.previousGeneratedAt,
          previousOverallLevel: report.comparison.previousOverallLevel,
          overallChange: report.comparison.overallChange,
          dimensionChanges: report.comparison.dimensionChanges.map((change) => ({
            dimension: change.dimension,
            previousLevel: change.previousLevel,
            currentLevel: change.currentLevel,
            change: change.change,
          })),
        }
      : null,
  };
}
