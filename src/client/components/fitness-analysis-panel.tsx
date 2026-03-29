"use client";

import { useCallback, useEffect, useState } from "react";

import { desktopAwareFetch } from "@/client/utils/diagnostics";

import { FitnessAnalysisContent } from "./fitness-analysis-content";
import {
  PROFILE_ORDER,
  buildAnalysisPayload,
  buildAnalysisQuery,
  clampPercent,
  formatTime,
  normalizeApiResponse,
  profileStateTone,
  readinessBarTone,
  type AnalyzeResponse,
  type FitnessProfile,
  type FitnessProfileState,
  type ProfilePanelState,
  toMessage,
} from "./fitness-analysis-types";
import { buildHeroModel, buildPrimaryActionLabel } from "./fitness-analysis-view-model";

type FitnessAnalysisPanelProps = {
  workspaceId?: string;
  codebaseId?: string;
  repoPath?: string;
  codebaseLabel?: string;
};

const EMPTY_STATE: Record<FitnessProfile, ProfilePanelState> = {
  generic: { state: "idle" },
  agent_orchestrator: { state: "idle" },
};

function StatusBadge({ state }: { state: FitnessProfileState }) {
  const labels: Record<FitnessProfileState, string> = {
    idle: "Idle",
    loading: "Running",
    ready: "Ready",
    empty: "Empty",
    error: "Error",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${profileStateTone(state)}`}>
      {labels[state]}
    </span>
  );
}

export function FitnessAnalysisPanel({
  workspaceId,
  codebaseId,
  repoPath,
  codebaseLabel,
}: FitnessAnalysisPanelProps) {
  const [profiles, setProfiles] = useState<Record<FitnessProfile, ProfilePanelState>>(EMPTY_STATE);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<string | null>(null);

  const hasContext = Boolean(workspaceId?.trim() || codebaseId?.trim() || repoPath?.trim());
  const contextQuery = buildAnalysisQuery({ workspaceId, codebaseId, repoPath });
  const contextPayload = buildAnalysisPayload(
    { workspaceId, codebaseId, repoPath },
    { mode: "deterministic" },
  );
  const contextLabel = codebaseLabel || repoPath || null;
  const compareLast = true;
  const noSave = false;

  const selectedProfile: FitnessProfile = "generic";
  const selectedState = profiles.generic;

  const applyProfiles = useCallback((entries: ReturnType<typeof normalizeApiResponse>) => {
    setProfiles((current) => {
      const next = { ...current };

      for (const profile of PROFILE_ORDER) {
        const entry = entries.find((item) => item.profile === profile);

        if (!entry) {
          next[profile] = {
            ...next[profile],
            state: "empty",
            error: `${new Date().toLocaleTimeString()} 未返回结果`,
          };
          continue;
        }

        if (entry.status === "ok" && entry.report) {
          next[profile] = {
            state: "ready",
            source: entry.source,
            durationMs: entry.durationMs,
            report: entry.report,
            updatedAt: entry.report.generatedAt,
          };
          continue;
        }

        if (entry.status === "missing") {
          next[profile] = {
            state: "empty",
            source: entry.source,
            error: entry.error ?? "暂无快照",
          };
          continue;
        }

        next[profile] = {
          state: "error",
          source: entry.source,
          durationMs: entry.durationMs,
          error: entry.error ?? "分析失败",
        };
      }

      return next;
    });

    setGlobalError(null);
  }, []);

  const syncProfiles = useCallback(async () => {
    if (!hasContext) {
      setProfiles(EMPTY_STATE);
      setLastSnapshotAt(null);
      setGlobalError("请先选择要分析的 Workspace 与 Repository");
      return;
    }

    setGlobalError(null);

    try {
      const reportUrl = contextQuery ? `/api/fitness/report?${contextQuery}` : "/api/fitness/report";
      const response = await desktopAwareFetch(reportUrl, { cache: "no-store" });

      if (!response.ok) {
        const body = await response.text();
        setGlobalError(`获取快照失败: ${response.status} ${body}`);
        return;
      }

      const raw = await response.json().catch(() => null);
      if (raw && typeof raw === "object" && typeof (raw as { generatedAt?: unknown }).generatedAt === "string") {
        setLastSnapshotAt((raw as { generatedAt: string }).generatedAt);
      } else {
        setLastSnapshotAt(new Date().toLocaleString());
      }

      applyProfiles(normalizeApiResponse(raw));
    } catch (error) {
      setGlobalError(`获取快照失败: ${toMessage(error)}`);
    }
  }, [applyProfiles, contextQuery, hasContext]);

  useEffect(() => {
    queueMicrotask(() => {
      void syncProfiles();
    });
  }, [syncProfiles]);

  const runProfiles = useCallback(async (targetProfiles: FitnessProfile[]) => {
    if (targetProfiles.length === 0) {
      return;
    }

    if (!hasContext) {
      const message = "请先在上方选择 Workspace 与 Repository";
      setGlobalError(message);
      setProfiles((current) => {
        const next = { ...current };
        for (const profile of targetProfiles) {
          next[profile] = {
            ...next[profile],
            state: "error",
            source: "analysis",
            error: message,
          };
        }
        return next;
      });
      return;
    }

    setGlobalError(null);
    setProfiles((current) => {
      const next = { ...current };
      for (const profile of targetProfiles) {
        next[profile] = {
          ...next[profile],
          state: "loading",
          error: undefined,
          updatedAt: new Date().toLocaleString(),
        };
      }
      return next;
    });

    try {
      const response = await desktopAwareFetch("/api/fitness/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profiles: targetProfiles,
          compareLast,
          noSave,
          ...contextPayload,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        const message = `执行失败: ${response.status} ${body || "空响应"}`;
        setGlobalError(message);
        setProfiles((current) => {
          const next = { ...current };
          for (const profile of targetProfiles) {
            next[profile] = {
              state: "error",
              source: "analysis",
              error: message,
            };
          }
          return next;
        });
        return;
      }

      const payload: AnalyzeResponse = await response.json().catch(() => ({
        generatedAt: new Date().toISOString(),
        requestedProfiles: targetProfiles,
        profiles: [],
      }));

      applyProfiles(normalizeApiResponse(payload));
      setLastSnapshotAt(payload.generatedAt);
    } catch (error) {
      const message = `执行失败: ${toMessage(error)}`;
      setGlobalError(message);
      setProfiles((current) => {
        const next = { ...current };
        for (const profile of targetProfiles) {
          next[profile] = {
            state: "error",
            source: "analysis",
            error: message,
          };
        }
        return next;
      });
    }
  }, [applyProfiles, compareLast, contextPayload, hasContext, noSave]);

  const onRunSelectedProfile = useCallback(() => {
    void runProfiles([selectedProfile]);
  }, [runProfiles, selectedProfile]);

  const selectedReport = selectedState.report;
  const blockers = selectedReport?.blockingCriteria ?? [];
  const failedCriteria = selectedReport?.criteria.filter((criterion) => criterion.status === "fail") ?? [];
  const heroModel = buildHeroModel(selectedReport, selectedProfile, selectedState.state);
  const primaryActionLabel = buildPrimaryActionLabel(selectedReport, selectedState.state);

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-desktop-border bg-desktop-bg-secondary/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-desktop-text-secondary">Generic report</div>
            <div className="mt-1 text-sm font-semibold text-desktop-text-primary">Repository</div>
            <div className="text-[12px] text-desktop-text-secondary">{contextLabel ?? "未设置"}</div>
          </div>
          <StatusBadge state={selectedState.state} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-desktop-text-secondary">
          <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-1.5 dark:bg-white/6">Profile: Generic</div>
          <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-1.5 dark:bg-white/6">
            Level: <span className="font-semibold text-desktop-text-primary">{heroModel.currentLevel}</span>
          </div>
          <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-1.5 dark:bg-white/6">
            Next: <span className="font-semibold text-desktop-text-primary">{heroModel.targetLevel}</span>
          </div>
          <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-1.5 dark:bg-white/6">
            Blockers: <span className="font-semibold text-desktop-text-primary">{selectedReport ? blockers.length : "N/A"}</span>
          </div>
          <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-1.5 dark:bg-white/6">
            Failed: <span className="font-semibold text-desktop-text-primary">{selectedReport ? failedCriteria.length : "N/A"}</span>
          </div>
          <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-1.5 dark:bg-white/6">
            {heroModel.confidenceSummary}
          </div>
          <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-1.5 dark:bg-white/6">
            Source: <span className="font-semibold text-desktop-text-primary">
              {selectedState.source === "analysis" ? "Live" : selectedState.source === "snapshot" ? "Snapshot" : "No data"}
            </span>
          </div>
          <div className="rounded-full border border-desktop-border bg-white/80 px-3 py-1.5 dark:bg-white/6">
            Updated: <span className="font-semibold text-desktop-text-primary">{selectedState.updatedAt ? formatTime(selectedState.updatedAt) : "No timestamp"}</span>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-desktop-bg-secondary">
          <div
            className={`h-full rounded-full ${readinessBarTone(selectedReport?.currentLevelReadiness ?? 0)}`}
            style={{ width: `${clampPercent(selectedReport?.currentLevelReadiness ?? 0)}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRunSelectedProfile}
            disabled={!hasContext || selectedState.state === "loading"}
            className="rounded-full bg-desktop-accent px-4 py-2 text-sm font-semibold text-desktop-text-on-accent disabled:opacity-60"
          >
            {primaryActionLabel}
          </button>
          <button
            type="button"
            onClick={() => void syncProfiles()}
            disabled={!hasContext}
            className="rounded-full border border-desktop-border px-4 py-2 text-sm font-semibold text-desktop-text-primary hover:bg-desktop-bg-primary/80 disabled:opacity-60"
          >
            Refresh latest report
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-dashed border-desktop-border px-3 py-2 text-[11px] text-desktop-text-secondary">
          {lastSnapshotAt ? `Latest snapshot: ${formatTime(lastSnapshotAt)}` : "No snapshot yet"}
        </div>

        {globalError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-700">
            {globalError}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-desktop-border bg-desktop-bg-secondary/60 p-4 shadow-sm">
        <FitnessAnalysisContent
          selectedProfile={selectedProfile}
          viewMode="overview"
          profileState={selectedState}
          report={selectedReport}
        />
      </section>
    </div>
  );
}
