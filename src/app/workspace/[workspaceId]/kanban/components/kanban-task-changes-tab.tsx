"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { KanbanEnhancedFileChangesPanel } from "./kanban-enhanced-file-changes-panel";
import type { KanbanTaskChanges } from "../kanban-file-changes-types";

interface KanbanTaskChangesTabProps {
  taskId: string;
  workspaceId: string;
  refreshSignal?: number;
  onRefresh: () => void;
}

export function KanbanTaskChangesTab({
  taskId,
  workspaceId,
  refreshSignal,
  onRefresh,
}: KanbanTaskChangesTabProps) {
  const { t } = useTranslation();
  const [taskChanges, setTaskChanges] = useState<KanbanTaskChanges | null>(null);
  const [taskChangesLoading, setTaskChangesLoading] = useState(false);

  useEffect(() => {
    setTaskChanges(null);
    setTaskChangesLoading(false);
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    setTaskChangesLoading(true);

    void (async () => {
      try {
        const response = await desktopAwareFetch(`/api/tasks/${encodeURIComponent(taskId)}/changes`, {
          cache: "no-store",
        });
        const payload = await response.json() as { changes?: KanbanTaskChanges; error?: string };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          throw new Error(payload.error ?? t.common.unavailable);
        }
        setTaskChanges(payload.changes ?? null);
      } catch (error) {
        if (!cancelled) {
          setTaskChanges({
            codebaseId: "",
            repoPath: "",
            label: t.kanbanDetail.repo,
            branch: "unknown",
            status: { clean: true, ahead: 0, behind: 0, modified: 0, untracked: 0 },
            files: [],
            source: "repo",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        if (!cancelled) {
          setTaskChangesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [taskId, refreshSignal, t.common.unavailable, t.kanbanDetail.repo]);

  return (
    <KanbanEnhancedFileChangesPanel
      taskId={taskId}
      workspaceId={workspaceId}
      changes={taskChanges}
      loading={taskChangesLoading}
      onRefresh={onRefresh}
      embedded={true}
    />
  );
}
