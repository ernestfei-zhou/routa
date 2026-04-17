"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { CanvasHost } from "@/client/canvas-runtime";
import {
  FitnessOverviewCanvas,
} from "@/client/canvas-sdk/prebuilt/fitness-overview";
import { darkTheme, lightTheme } from "@/client/canvas-sdk/tokens";
import { DesktopAppShell } from "@/client/components/desktop-app-shell";
import { buildFitnessOverviewCanvasData } from "@/client/components/fitness-canvas-data";
import { useCodebases, useWorkspaces } from "@/client/hooks/use-workspaces";
import { useLiveFitnessCanvasReport } from "@/client/hooks/use-live-fitness-canvas-report";
import { useTranslation } from "@/i18n";

import { useRuntimeFitnessStatus } from "../use-runtime-fitness-status";

function resolveWorkspaceId(rawWorkspaceId: string): string {
  if (rawWorkspaceId !== "__placeholder__" || typeof window === "undefined") {
    return rawWorkspaceId;
  }

  return window.location.pathname.match(/^\/workspace\/([^/]+)/)?.[1]
    ?? rawWorkspaceId;
}

function formatModeLabel(
  mode: "fast" | "full" | undefined,
  fastLabel: string,
  fullLabel: string,
): string | null {
  if (mode === "fast") return fastLabel;
  if (mode === "full") return fullLabel;
  return null;
}

function formatScore(value: number | null | undefined): string | null {
  return typeof value === "number" ? value.toFixed(1) : null;
}

function formatObservedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toLocaleString();
}

function selectDisplayedFitness(
  runtimeFitness: ReturnType<typeof useRuntimeFitnessStatus>["data"],
) {
  if (!runtimeFitness) return null;
  if (runtimeFitness.hasRunning) {
    return runtimeFitness.modes.find((summary) => summary.currentStatus === "running")
      ?? runtimeFitness.latest
      ?? null;
  }
  return runtimeFitness.latest ?? null;
}

export function KanbanFitnessCanvasPageClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = resolveWorkspaceId(params.workspaceId as string);
  const requestedCodebaseId = searchParams.get("codebaseId") ?? "";
  const requestedRepoPath = searchParams.get("repoPath") ?? "";
  const [themeName, setThemeName] = useState<"dark" | "light">("dark");
  const theme = themeName === "dark" ? darkTheme : lightTheme;
  const { t } = useTranslation();
  const workspacesHook = useWorkspaces();
  const { codebases } = useCodebases(workspaceId);

  const activeWorkspaceTitle = useMemo(() => {
    return workspacesHook.workspaces.find((workspace) => workspace.id === workspaceId)?.title
      ?? workspacesHook.workspaces[0]?.title
      ?? workspaceId;
  }, [workspaceId, workspacesHook.workspaces]);

  const activeCodebase = useMemo(() => {
    if (requestedCodebaseId) {
      return codebases.find((codebase) => codebase.id === requestedCodebaseId) ?? null;
    }
    if (requestedRepoPath) {
      return codebases.find((codebase) => codebase.repoPath === requestedRepoPath) ?? null;
    }
    return codebases.find((codebase) => codebase.isDefault) ?? codebases[0] ?? null;
  }, [codebases, requestedCodebaseId, requestedRepoPath]);

  const runtimeFitness = useRuntimeFitnessStatus({
    workspaceId,
    codebaseId: activeCodebase?.id ?? requestedCodebaseId,
    repoPath: activeCodebase?.repoPath ?? requestedRepoPath,
    enabled: Boolean(workspaceId),
  });
  const liveReport = useLiveFitnessCanvasReport({
    workspaceId,
    codebaseId: activeCodebase?.id ?? requestedCodebaseId,
    repoPath: activeCodebase?.repoPath ?? requestedRepoPath,
  });

  const selectedFitness = useMemo(
    () => selectDisplayedFitness(runtimeFitness.data),
    [runtimeFitness.data],
  );
  const runtimeModeLabel = formatModeLabel(
    selectedFitness?.mode,
    t.kanban.fitnessModeFast,
    t.kanban.fitnessModeFull,
  );
  const runtimeStatusLabel = selectedFitness?.currentStatus === "running"
    ? t.kanban.runningLabel
    : selectedFitness?.currentStatus === "failed"
      ? selectedFitness.hardGateBlocked
        ? t.kanban.fitnessHardGate
        : selectedFitness.scoreBlocked
          ? t.kanban.fitnessScoreBlocked
          : t.kanban.fitnessBlocked
      : selectedFitness?.currentStatus === "skipped"
        ? t.kanban.fitnessSkipped
        : selectedFitness?.currentStatus === "passed"
          ? t.kanban.synced
          : runtimeFitness.loading
            ? t.kanban.fitnessLoading
            : runtimeFitness.error
              ? t.kanban.fitnessIssue
              : t.kanban.fitnessNoData;
  const runtimeScore = selectedFitness?.currentStatus === "running"
    ? formatScore(selectedFitness.lastCompleted?.finalScore)
    : formatScore(selectedFitness?.finalScore ?? selectedFitness?.lastCompleted?.finalScore);
  const runtimeSummary = [
    runtimeModeLabel,
    runtimeStatusLabel,
    runtimeScore,
    formatObservedAt(selectedFitness?.currentObservedAt),
  ].filter(Boolean).join(" · ");

  const canvasData = useMemo(
    () => (liveReport.report ? buildFitnessOverviewCanvasData(liveReport.report) : null),
    [liveReport.report],
  );
  const sourceLabel = liveReport.source === "analysis"
    ? t.fitness.panel.reportSourceLive
    : liveReport.source === "snapshot"
      ? t.fitness.panel.reportSourceSnapshot
      : t.fitness.panel.reportSourceNone;
  const lastRuntimeKeyRef = useRef<string | null>(null);
  const refreshLiveReport = liveReport.refresh;

  useEffect(() => {
    const latest = runtimeFitness.data?.latest;
    if (!latest?.currentObservedAt) {
      return;
    }

    const currentKey = `${latest.mode}:${latest.currentStatus}:${latest.currentObservedAt}`;
    if (lastRuntimeKeyRef.current == null) {
      lastRuntimeKeyRef.current = currentKey;
      return;
    }

    if (lastRuntimeKeyRef.current === currentKey) {
      return;
    }

    lastRuntimeKeyRef.current = currentKey;

    if (
      latest.currentStatus === "passed"
      || latest.currentStatus === "failed"
      || latest.currentStatus === "skipped"
    ) {
      refreshLiveReport();
    }
  }, [refreshLiveReport, runtimeFitness.data?.latest]);

  const activeRepoLabel = activeCodebase?.label
    ?? activeCodebase?.repoPath.split("/").pop()
    ?? (requestedRepoPath ? requestedRepoPath.split("/").pop() : null)
    ?? t.settings.repository;
  const activeRepoPath = activeCodebase?.repoPath || requestedRepoPath || "-";
  const emptyStateMessage = liveReport.loading || liveReport.refreshing
    ? t.fitness.overview.noReportTextLoading
    : t.fitness.overview.noReportTextNotReady;

  return (
    <DesktopAppShell
      workspaceId={workspaceId}
      workspaceTitle={activeWorkspaceTitle}
      titleBarRight={(
        <div className="flex items-center gap-2">
          <span className="hidden max-w-[260px] truncate text-[11px] text-desktop-text-secondary md:inline">
            {activeRepoLabel}
          </span>
          <button
            type="button"
            onClick={() => router.push(`/workspace/${workspaceId}/kanban`)}
            className="h-7 rounded-sm border border-desktop-border px-3 text-[12px] font-semibold leading-none text-desktop-text-primary hover:bg-desktop-bg-primary/80"
          >
            {t.nav.kanban}
          </button>
          <button
            type="button"
            onClick={liveReport.refresh}
            disabled={liveReport.loading || liveReport.refreshing}
            className="h-7 rounded-sm bg-desktop-accent px-3 text-[12px] font-semibold leading-none text-desktop-text-on-accent disabled:opacity-60"
          >
            {t.fitness.panel.refresh}
          </button>
          <button
            type="button"
            onClick={() =>
              setThemeName((current) => (current === "dark" ? "light" : "dark"))
            }
            className="h-7 rounded-sm border border-desktop-border px-3 text-[12px] font-semibold leading-none text-desktop-text-primary hover:bg-desktop-bg-primary/80"
          >
            {themeName === "dark" ? "☀" : "☾"}
          </button>
        </div>
      )}
    >
      <div className="flex h-full min-h-0 flex-col bg-desktop-bg-primary text-desktop-text-primary">
        <div className="border-b border-desktop-border bg-desktop-bg-secondary/50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">
                {t.kanban.fitnessLabel}
              </div>
              <div className="mt-1 text-sm font-semibold text-desktop-text-primary">
                {activeRepoLabel}
              </div>
              <div className="mt-1 text-[11px] text-desktop-text-secondary">
                {runtimeSummary || t.kanban.fitnessNoData}
              </div>
              <div className="mt-1 truncate text-[11px] text-desktop-text-secondary">
                {activeRepoPath}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-desktop-text-secondary">
              <span className="rounded-sm border border-desktop-border px-2 py-1">
                {sourceLabel}
              </span>
              {liveReport.updatedAt ? (
                <span className="rounded-sm border border-desktop-border px-2 py-1">
                  {formatObservedAt(liveReport.updatedAt)}
                </span>
              ) : null}
            </div>
          </div>

          {liveReport.error ? (
            <div className="mt-3 rounded-sm border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-200">
              {liveReport.error}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <CanvasHost theme={theme}>
            <div
              style={{
                minHeight: "100%",
                background: theme.tokens.bg.editor,
                padding: 24,
              }}
            >
              {canvasData ? (
                <FitnessOverviewCanvas data={canvasData} />
              ) : (
                <div
                  style={{
                    border: `1px dashed ${theme.tokens.stroke.secondary}`,
                    borderRadius: 12,
                    color: theme.tokens.text.secondary,
                    padding: 24,
                  }}
                >
                  {emptyStateMessage}
                </div>
              )}
            </div>
          </CanvasHost>
        </div>
      </div>
    </DesktopAppShell>
  );
}
