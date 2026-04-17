"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildAnalysisPayload,
  buildAnalysisQuery,
  normalizeApiResponse,
  toMessage,
  type FitnessReport,
} from "@/client/components/fitness-analysis-types";
import { resolveApiPath } from "@/client/config/backend";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { useTranslation } from "@/i18n";

type UseLiveFitnessCanvasReportOptions = {
  workspaceId?: string;
  codebaseId?: string | null;
  repoPath?: string | null;
};

type FitnessCanvasReportSource = "snapshot" | "analysis";

type LiveFitnessCanvasReportState = {
  report: FitnessReport | null;
  source: FitnessCanvasReportSource | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  updatedAt: string | null;
  refresh: () => void;
};

function pickGenericReport(payload: unknown): {
  report: FitnessReport | null;
  source: FitnessCanvasReportSource | null;
} {
  const entry = normalizeApiResponse(payload).find(
    (candidate) =>
      candidate.profile === "generic"
      && candidate.status === "ok"
      && candidate.report != null,
  );

  if (!entry?.report) {
    return { report: null, source: null };
  }

  return {
    report: entry.report,
    source: entry.source,
  };
}

export function useLiveFitnessCanvasReport({
  workspaceId,
  codebaseId,
  repoPath,
}: UseLiveFitnessCanvasReportOptions): LiveFitnessCanvasReportState {
  const { t } = useTranslation();
  const [report, setReport] = useState<FitnessReport | null>(null);
  const [source, setSource] = useState<FitnessCanvasReportSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const hasReportRef = useRef(false);

  const context = useMemo(
    () => ({
      workspaceId: workspaceId?.trim() || undefined,
      codebaseId: codebaseId?.trim() || undefined,
      repoPath: repoPath?.trim() || undefined,
    }),
    [codebaseId, repoPath, workspaceId],
  );
  const contextQuery = useMemo(() => buildAnalysisQuery(context), [context]);
  const analyzePayload = useMemo(
    () => ({
      ...buildAnalysisPayload(context, { mode: "deterministic" }),
      compareLast: true,
      profile: "generic" as const,
    }),
    [context],
  );
  const hasContext = contextQuery.length > 0;

  useEffect(() => {
    hasReportRef.current = report != null;
  }, [report]);

  useEffect(() => {
    hasReportRef.current = false;
    setReport(null);
    setSource(null);
    setError(null);
    setUpdatedAt(null);
  }, [contextQuery]);

  useEffect(() => {
    if (!hasContext) {
      setReport(null);
      setSource(null);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      setUpdatedAt(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(!hasReportRef.current);
      setRefreshing(false);
      setError(null);

      try {
        const snapshotResponse = await desktopAwareFetch(
          `${resolveApiPath("/api/fitness/report")}?${contextQuery}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const snapshotPayload = await snapshotResponse.json().catch(() => ({}));
        if (!snapshotResponse.ok) {
          throw new Error(
            `${t.fitness.panel.fetchSnapshotFailed}${toMessage(snapshotPayload?.details ?? snapshotPayload?.error ?? snapshotResponse.status)}`,
          );
        }

        if (cancelled) return;

        const snapshot = pickGenericReport(snapshotPayload);
        if (snapshot.report) {
          setReport(snapshot.report);
          setSource(snapshot.source);
          setUpdatedAt(snapshot.report.generatedAt);
        }
      } catch (snapshotError) {
        if ((snapshotError as Error).name === "AbortError" || cancelled) {
          return;
        }
        setError(toMessage(snapshotError));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(true);
        }
      }

      try {
        const analyzeResponse = await desktopAwareFetch(
          resolveApiPath("/api/fitness/analyze"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(analyzePayload),
            signal: controller.signal,
          },
        );

        const analyzeResult = await analyzeResponse.json().catch(() => ({}));
        if (!analyzeResponse.ok) {
          throw new Error(
            `${t.fitness.panel.analyzeFailedPrefix}${toMessage(analyzeResult?.details ?? analyzeResult?.error ?? analyzeResponse.status)}`,
          );
        }

        if (cancelled) return;

        const analyzed = pickGenericReport(analyzeResult);
        if (analyzed.report) {
          setReport(analyzed.report);
          setSource(analyzed.source);
          setUpdatedAt(analyzed.report.generatedAt);
          setError(null);
        }
      } catch (analyzeError) {
        if ((analyzeError as Error).name === "AbortError" || cancelled) {
          return;
        }
        setError(toMessage(analyzeError));
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    analyzePayload,
    contextQuery,
    hasContext,
    refreshNonce,
    t.fitness.panel.analyzeFailedPrefix,
    t.fitness.panel.fetchSnapshotFailed,
  ]);

  const refresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  return {
    report,
    source,
    loading,
    refreshing,
    error,
    updatedAt,
    refresh,
  };
}
