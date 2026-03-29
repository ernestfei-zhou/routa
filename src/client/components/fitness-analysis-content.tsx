"use client";

import { useMemo, useState } from "react";

import {
  clampPercent,
  criterionShortLabel,
  criterionStatusTone,
  formatTime,
  humanizeToken,
  levelChangeTone,
  readinessBadgeTone,
  readinessBarTone,
  type CellResult,
  type CriterionResult,
  type FitnessRecommendation,
  type FitnessProfile,
  type FitnessReport,
  type ProfilePanelState,
  type ViewMode,
} from "./fitness-analysis-types";
type FitnessAnalysisContentProps = {
  selectedProfile: FitnessProfile;
  viewMode: ViewMode;
  profileState: ProfilePanelState;
  report?: FitnessReport;
};

type DimensionGroup = {
  key: string;
  name: string;
  cells: CellResult[];
  failedCriteria: number;
  criticalFailures: number;
  averageScore: number;
};

type MeasureSpec = {
  title: string;
  subtitle: string;
  body: string;
  examples: string[];
  without: string;
};

type MeasureEntry = {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  examples: string[];
  without: string;
  levelName: string;
  score: number;
  failedCriteria: CriterionResult[];
  recommendations: FitnessRecommendation[];
};

const MEASURE_ORDER = ["collaboration", "sdlc", "harness", "governance", "context"] as const;

const MEASURE_SPECS: Record<string, MeasureSpec> = {
  governance: {
    title: "Verification & Guardrails",
    subtitle: "Ownership, validation, and policy controls",
    body: "A repository needs verifiable ownership and validation rules so agent changes can be trusted and reviewed safely.",
    examples: ["CODEOWNERS", "docs/fitness/review-triggers.yaml", "test/lint gates"],
    without: "Without these controls, agents can produce valid-looking changes that still violate collaboration or release safety rules.",
  },
  harness: {
    title: "Workflow Loop",
    subtitle: "Execution and verification loop",
    body: "Agents need a reliable execution surface: commands, checks, and runtime feedback must be repeatable.",
    examples: ["commands in package scripts", "fitness or build checks", "runtime entrypoints"],
    without: "Without a stable loop, agents cannot verify whether code changes actually work before handoff.",
  },
  context: {
    title: "Context Readiness",
    subtitle: "Context depth and memory for execution",
    body: "Agents rely on layered context to reduce repeated discovery and stay consistent across edits.",
    examples: ["docs/product-specs", "docs/design-docs", "docs/exec-plans", "docs/references"],
    without: "Without context depth, agents lose momentum and make repeated assumption-driven changes.",
  },
  sdlc: {
    title: "Process Expansion",
    subtitle: "Delivery cadence and process continuity",
    body: "A stable process lets agents move from code edits to verification and handoff without hidden assumptions.",
    examples: ["CI and test pipelines", "task handoff conventions", "release checks"],
    without: "Without process clarity, fixes may compile but still block downstream workflows.",
  },
  collaboration: {
    title: "Task Delegation",
    subtitle: "Handoffs and multi-agent coordination",
    body: "Clear delegation rules let multiple agents and people work on one repository without conflicting assumptions.",
    examples: ["AGENTS.md", "planner/specialist commands", "handoff conventions"],
    without: "Without coordination, parallel work becomes duplicated or stalled across agent boundaries.",
  },
};

function RecommendationCard({
  action,
  whyItMatters,
  evidenceHint,
  critical,
}: {
  action: string;
  whyItMatters: string;
  evidenceHint: string;
  critical: boolean;
}) {
  return (
    <article className="rounded-xl border border-desktop-border bg-white/80 p-3 dark:bg-white/6">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-desktop-text-primary">{action}</div>
        {critical ? (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">
            critical
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-[11px] leading-5 text-desktop-text-secondary">{whyItMatters}</div>
      <div className="mt-2 rounded-xl border border-desktop-border bg-desktop-bg-primary/80 px-3 py-2 text-[11px] text-desktop-text-secondary">
        从这里开始：{evidenceHint}
      </div>
    </article>
  );
}

function sortCells(left: CellResult, right: CellResult) {
  if (left.passed !== right.passed) {
    return left.passed ? 1 : -1;
  }

  return left.score - right.score;
}

function buildDimensionGroups(report: FitnessReport): DimensionGroup[] {
  const groups = new Map<string, DimensionGroup>();

  for (const cell of report.cells) {
    const current = groups.get(cell.dimension) ?? {
      key: cell.dimension,
      name: cell.dimensionName,
      cells: [],
      failedCriteria: 0,
      criticalFailures: 0,
      averageScore: 0,
    };

    current.cells.push(cell);
    current.failedCriteria += cell.criteria.filter((criterion) => criterion.status === "fail").length;
    current.criticalFailures += cell.criteria.filter((criterion) => criterion.critical && criterion.status === "fail").length;
    groups.set(cell.dimension, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      cells: group.cells.slice().sort(sortCells),
      averageScore: group.cells.reduce((sum, cell) => sum + cell.score, 0) / Math.max(group.cells.length, 1),
    }))
    .sort((left, right) => {
      if (left.criticalFailures !== right.criticalFailures) {
        return right.criticalFailures - left.criticalFailures;
      }
      if (left.failedCriteria !== right.failedCriteria) {
        return right.failedCriteria - left.failedCriteria;
      }
      return left.averageScore - right.averageScore;
    });
}

function buildMeasureEntries(report: FitnessReport): MeasureEntry[] {
  return MEASURE_ORDER.map((dimension) => {
    const spec = MEASURE_SPECS[dimension] ?? {
      title: humanizeToken(dimension),
      subtitle: "Repository measure",
      body: "This dimension captures one part of repository readiness.",
      examples: [],
      without: "Agents lose confidence in this area and require more manual guidance.",
    };
    const dimensionInfo = report.dimensions[dimension];
    const failedCriteria = report.criteria.filter((criterion) => criterion.dimension === dimension && criterion.status === "fail");
    const recommendations = report.recommendations.filter((item) => item.criterionId.startsWith(`${dimension}.`));

    return {
      key: dimension,
      title: spec.title,
      subtitle: spec.subtitle,
      body: spec.body,
      examples: spec.examples,
      without: spec.without,
      levelName: dimensionInfo?.levelName ?? "Not reached",
      score: dimensionInfo?.score ?? 0,
      failedCriteria,
      recommendations,
    };
  });
}

function CapabilityCellCard({ cell }: { cell: CellResult }) {
  const score = clampPercent(cell.score);
  const failedCriteria = cell.criteria.filter((criterion) => criterion.status === "fail");
  const criticalFailures = failedCriteria.filter((criterion) => criterion.critical);

  return (
    <article className="rounded-2xl border border-desktop-border bg-white/85 p-4 shadow-sm dark:bg-white/6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-desktop-text-secondary">
            {cell.dimensionName}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-desktop-text-secondary">
            {humanizeToken(cell.level)}
          </div>
          <h4 className="mt-1 text-sm font-semibold text-desktop-text-primary">{cell.levelName}</h4>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${readinessBadgeTone(cell.score)}`}>
          {score}%
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-desktop-bg-primary">
        <div className={`h-full rounded-full ${readinessBarTone(cell.score)}`} style={{ width: `${score}%` }} />
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-desktop-text-secondary sm:grid-cols-3">
        <div>{cell.passedWeight}/{cell.applicableWeight} weighted checks</div>
        <div>{failedCriteria.length} failing criteria</div>
        <div>{criticalFailures.length} critical blockers</div>
      </div>

      {failedCriteria.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {failedCriteria.slice(0, 4).map((criterion) => (
            <span
              key={criterion.id}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${criterionStatusTone(criterion.status)}`}
            >
              {criterionShortLabel(criterion.id)}
            </span>
          ))}
          {failedCriteria.length > 4 ? (
            <span className="rounded-full border border-desktop-border px-2 py-0.5 text-[10px] text-desktop-text-secondary">
              +{failedCriteria.length - 4}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-desktop-border px-3 py-3 text-[11px] text-desktop-text-secondary">
          No failures
        </div>
      )}
    </article>
  );
}

function OverviewView({
  report,
}: {
  report: FitnessReport;
}) {
  const measureEntries = useMemo(() => buildMeasureEntries(report), [report]);
  const [selectedMeasure, setSelectedMeasure] = useState(measureEntries[0]?.key ?? "governance");
  const activeMeasure = measureEntries.find((entry) => entry.key === selectedMeasure) ?? measureEntries[0];

  if (!activeMeasure) {
    return (
      <div className="rounded-2xl border border-dashed border-desktop-border px-4 py-8 text-sm text-desktop-text-secondary">
        当前报告没有可展示的维度数据。
      </div>
    );
  }

  return (
    <section className="border border-desktop-border bg-desktop-bg-secondary/60 my-2 overflow-hidden rounded-2xl">
      <div className="flex flex-col lg:flex-row">
        <div className="border-desktop-border flex w-full shrink-0 flex-col border-b lg:w-60 lg:border-r lg:border-b-0">
          {measureEntries.map((entry) => {
            const active = entry.key === activeMeasure.key;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setSelectedMeasure(entry.key)}
                className={`border-desktop-border flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 ${
                  active ? "bg-desktop-accent/8" : "hover:bg-desktop-bg-primary/80"
                }`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${entry.failedCriteria.length > 0 ? "bg-amber-400" : "bg-emerald-400"}`} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-desktop-text-primary">{entry.title}</span>
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1 p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${activeMeasure.failedCriteria.length > 0 ? "bg-amber-400" : "bg-emerald-400"}`} />
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-desktop-text-primary">{activeMeasure.title}</div>
              <div className="mt-1 text-[12px] text-desktop-text-secondary">{activeMeasure.subtitle}</div>
            </div>
          </div>

          <p className="text-[13px] leading-6 text-desktop-text-secondary">{activeMeasure.body}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-2 text-[11px] text-desktop-text-secondary dark:bg-white/6">
              Level:
              <span className="ml-1 font-semibold text-desktop-text-primary">{activeMeasure.levelName}</span>
            </div>
            <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-2 text-[11px] text-desktop-text-secondary dark:bg-white/6">
              Score:
              <span className="ml-1 font-semibold text-desktop-text-primary">{clampPercent(activeMeasure.score)}%</span>
            </div>
            <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-2 text-[11px] text-desktop-text-secondary dark:bg-white/6">
              Fails:
              <span className="ml-1 font-semibold text-desktop-text-primary">{activeMeasure.failedCriteria.length}</span>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.04em] text-desktop-text-secondary">Examples</p>
            <ul className="flex flex-col gap-1">
              {activeMeasure.examples.map((example) => (
                <li key={example} className="flex items-baseline gap-2">
                  <span className="text-[10px] leading-none text-desktop-text-secondary">•</span>
                  <span className="font-mono text-[12px] text-desktop-text-primary">{example}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div>
              <div className="text-[12px] font-semibold text-desktop-text-primary">Current findings</div>
              <div className="mt-3 space-y-3">
                {activeMeasure.failedCriteria.length > 0 ? (
                  activeMeasure.failedCriteria.slice(0, 4).map((criterion) => (
                    <article key={criterion.id} className="rounded-xl border border-desktop-border bg-white/80 p-3 dark:bg-white/6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-desktop-text-primary">{criterionShortLabel(criterion.id)}</div>
                          <div className="mt-1 font-mono text-[10px] text-desktop-text-secondary">{criterion.id}</div>
                        </div>
                        {criterion.critical ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">
                            critical
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[11px] leading-5 text-desktop-text-secondary">{criterion.whyItMatters}</div>
                      <div className="mt-2 text-[11px] leading-5 text-desktop-text-secondary">Start: {criterion.evidenceHint}</div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-desktop-border px-4 py-6 text-sm text-desktop-text-secondary">
                    No active blockers
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-desktop-border bg-white/80 p-4 dark:bg-white/6">
                <div className="text-[12px] font-semibold text-desktop-text-primary">Recommended actions</div>
                <div className="mt-3 space-y-2">
                  {activeMeasure.recommendations.length > 0 ? (
                    activeMeasure.recommendations.slice(0, 3).map((item) => (
                      <article key={item.criterionId} className="rounded-xl border border-desktop-border bg-desktop-bg-primary/80 p-3">
                        <div className="text-sm font-semibold text-desktop-text-primary">{item.action}</div>
                        <div className="mt-2 text-[11px] leading-5 text-desktop-text-secondary">{item.evidenceHint}</div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-desktop-border px-3 py-4 text-[11px] text-desktop-text-secondary">
                      No actions
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-desktop-border bg-white/80 p-4 dark:bg-white/6">
                <div className="text-[12px] font-semibold text-desktop-text-primary">Without this</div>
                <p className="mt-2 text-[12px] leading-6 text-desktop-text-secondary">{activeMeasure.without}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CapabilitiesView({ report }: { report: FitnessReport }) {
  const groups = useMemo(() => buildDimensionGroups(report), [report]);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key} className="rounded-2xl border border-desktop-border bg-desktop-bg-secondary/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">
                {group.name}
              </div>
              <p className="mt-1 text-[11px] text-desktop-text-secondary">
                {group.cells.length} cells · {group.failedCriteria} failing criteria · {group.criticalFailures} critical blockers
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${readinessBadgeTone(group.averageScore)}`}>
              {clampPercent(group.averageScore)}%
            </span>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {group.cells.map((cell) => (
              <CapabilityCellCard key={cell.id} cell={cell} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RecommendationsView({ report }: { report: FitnessReport }) {
  if (report.recommendations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-desktop-border px-4 py-6 text-sm text-desktop-text-secondary">
        当前 Profile 没有建议数据。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {report.recommendations.map((item) => (
        <RecommendationCard
          key={item.criterionId}
          action={item.action}
          whyItMatters={item.whyItMatters}
          evidenceHint={item.evidenceHint}
          critical={item.critical}
        />
      ))}
    </div>
  );
}

function ChangesView({ report }: { report: FitnessReport }) {
  if (!report.comparison) {
    return (
      <div className="rounded-2xl border border-dashed border-desktop-border p-4 text-sm text-desktop-text-secondary">
        当前快照未开启历史对比，或缺少历史快照。重新运行时勾选“与上次对比”即可补充。
      </div>
    );
  }

  const comp = report.comparison;

  return (
    <div className="space-y-4">
      <article className="rounded-2xl border border-desktop-border bg-desktop-bg-secondary/60 p-4">
        <div className="text-sm text-desktop-text-primary">与上次对比：{formatTime(comp.previousGeneratedAt)}</div>
        <div className="mt-2 text-xs text-desktop-text-secondary">
          上次总体：{comp.previousOverallLevel} → 当前总体：{report.overallLevel}
          <span className={`ml-2 font-semibold ${levelChangeTone(comp.overallChange)}`}>
            {comp.overallChange === "up" ? "上升" : comp.overallChange === "down" ? "下降" : "持平"}
          </span>
        </div>
      </article>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-desktop-border bg-desktop-bg-secondary/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">维度变化</div>
          {comp.dimensionChanges.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {comp.dimensionChanges.map((item) => (
                <li key={`${item.dimension}-${item.currentLevel}`} className="flex items-center justify-between text-sm">
                  <span className="text-desktop-text-secondary">{humanizeToken(item.dimension)}</span>
                  <span className="font-semibold text-desktop-text-primary">
                    {item.previousLevel}
                    <span className="px-1 text-desktop-text-secondary">→</span>
                    {item.currentLevel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-desktop-text-secondary">当前未检测到维度变化。</p>
          )}
        </div>
        <div className="rounded-2xl border border-desktop-border bg-desktop-bg-secondary/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">关键项状态变化</div>
          {comp.criteriaChanges.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {comp.criteriaChanges.slice(0, 8).map((item) => (
                <li key={item.id} className="rounded-xl border border-desktop-border bg-white/85 p-3 dark:bg-white/6">
                  <div className="font-mono text-[11px] text-desktop-text-secondary">{item.id}</div>
                  <div className="mt-1 text-xs text-desktop-text-secondary">
                    {item.previousStatus ?? "unknown"} → {item.currentStatus ?? "unknown"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-desktop-text-secondary">暂无关键项状态变化。</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function FitnessAnalysisContent({
  selectedProfile,
  viewMode,
  profileState,
  report,
}: FitnessAnalysisContentProps) {
  if (!report) {
    return (
      <div className="rounded-2xl border border-dashed border-desktop-border px-4 py-8 text-sm text-desktop-text-secondary">
        {profileState.state === "loading"
          ? "正在生成 fluency 报告。"
          : profileState.error ?? `当前还没有 ${selectedProfile} 的报告，先运行一次分析。`}
      </div>
    );
  }

  if (viewMode === "capabilities") {
    return <CapabilitiesView report={report} />;
  }

  if (viewMode === "recommendations") {
    return <RecommendationsView report={report} />;
  }

  if (viewMode === "changes") {
    return <ChangesView report={report} />;
  }

  return <OverviewView report={report} />;
}
