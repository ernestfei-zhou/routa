"use client";

import { normalizeKanbanAutomation } from "@/core/models/kanban";
import type { AcpProviderInfo } from "@/client/acp-client";
import type { UseAcpState, UseAcpActions } from "@/client/hooks/use-acp";
import type { CodebaseData, TaskDraft } from "@/client/hooks/use-workspaces";
import { type ColumnAutomationConfig } from "./kanban-settings-modal";
import type { KanbanRepoChanges } from "./kanban-file-changes-types";
import { getKanbanFileChangesSummary } from "./kanban-file-changes-panel";
import type { KanbanSpecialistLanguage } from "./kanban-specialist-language";
import type { KanbanTabContentProps, KanbanTabHeaderActionProps } from "./kanban-tab-content";
import type { KanbanBoardInfo, KanbanAgentPromptHandler, SessionInfo, TaskInfo, WorktreeInfo } from "../types";
import type { KanbanTaskAgentCopy } from "./i18n/kanban-task-agent";
import type { RepoSelection } from "@/client/components/repo-picker";

interface RepoSyncState {
  status: string;
  provider: string;
}

type BuilderInput = Record<string, unknown>;

export function buildKanbanTabContentProps(input: BuilderInput): KanbanTabContentProps {
  const get = <T,>(key: string): T => input[key] as T;

  const tasksCount = get<number>("tasksCount");
  const board = get<KanbanBoardInfo | null>("board");
  const boardQueue = get<KanbanBoardInfo["queue"]>("boardQueue");
  const boards = get<KanbanBoardInfo[]>("boards");
  const selectedBoardId = get<string | null>("selectedBoardId");
  const onSelectBoard = get<(boardId: string | null) => void>("onSelectBoard");
  const githubImportEnabled = get<boolean>("githubImportEnabled");
  const onOpenGitHubImport = get<() => void>("onOpenGitHubImport");
  const onRefresh = get<() => void>("onRefresh");
  const onOpenSettings = get<(() => void) | undefined>("onOpenSettings");

  const onAgentPrompt = get<KanbanAgentPromptHandler | undefined>("onAgentPrompt");
  const availableProviders = get<AcpProviderInfo[]>("availableProviders");
  const selectedProviderId = get<string>("selectedProviderId");
  const onBoardProviderChange = get<(providerId: string) => void>("onBoardProviderChange");
  const disableBoardProvider = get<boolean>("disableBoardProvider");
  const kanbanTaskAgentCopy = get<KanbanTaskAgentCopy>("kanbanTaskAgentCopy");
  const agentInput = get<string>("agentInput");
  const onAgentInputChange = get<(value: string) => void>("onAgentInputChange");
  const onAgentSubmit = get<() => void>("onAgentSubmit");
  const showCreateTaskModal = get<() => void>("showCreateTaskModal");
  const agentLoading = get<boolean>("agentLoading");
  const agentSessionId = get<string | null>("agentSessionId");
  const openAgentPanel = get<(sessionId: string) => void>("openAgentPanel");

  const moveError = get<string | null>("moveError");
  const onDismissMoveError = get<() => void>("onDismissMoveError");
  const codebases = get<CodebaseData[]>("codebases");
  const workspaceId = get<string>("workspaceId");
  const defaultCodebase = get<CodebaseData | null>("defaultCodebase");
  const repoSync = get<RepoSyncState | undefined>("repoSync");
  const setSelectedCodebase = get<(codebase: CodebaseData | null) => void>("setSelectedCodebase");
  const fetchCodebaseWorktrees = get<(codebase: CodebaseData) => Promise<void> | void>("fetchCodebaseWorktrees");
  const repoChanges = get<KanbanRepoChanges[]>("repoChanges");
  const repoChangesLoading = get<boolean>("repoChangesLoading");
  const boardAutoProviderId = get<string>("boardAutoProviderId");
  const acp = get<UseAcpState & UseAcpActions | undefined>("acp");
  const agentSession = get<SessionInfo | null>("agentSession");
  const agentPanelOpen = get<boolean>("agentPanelOpen");
  const visibleColumns = get<string[]>("visibleColumns");
  const boardTasks = get<TaskInfo[]>("boardTasks");
  const columnAutomation = get<Record<string, ColumnAutomationConfig>>("columnAutomation");
  const providers = get<AcpProviderInfo[]>("providers");
  const specialists = get<Array<{ id: string; name: string; role: string; displayName?: string; defaultProvider?: string; }>>("specialists");
  const specialistLanguage = get<KanbanSpecialistLanguage>("specialistLanguage");
  const sessionMap = get<Map<string, SessionInfo>>("sessionMap");
  const liveSessionTails = get<Record<string, string>>("liveSessionTails");
  const allCodebaseIds = get<string[]>("allCodebaseIds");
  const worktreeCache = get<Record<string, WorktreeInfo>>("worktreeCache");
  const queuedPositions = get<Record<string, { taskId: string; index: number }>>("queuedPositions");
  const dragTaskId = get<string | null>("dragTaskId");
  const setDragTaskId = get<(taskId: string | null) => void>("setDragTaskId");
  const moveTask = get<(taskId: string, targetColumnId: string) => Promise<void>>("moveTask");
  const confirmDeleteTask = get<(task: TaskInfo) => void>("confirmDeleteTask");
  const patchTask = get<(taskId: string, payload: Record<string, unknown>) => Promise<TaskInfo>>("patchTask");
  const retryTaskTrigger = get<(task: TaskInfo) => void>("retryTaskTrigger");
  const runTaskPullRequest = get<(task: TaskInfo) => Promise<void>>("runTaskPullRequest");
  const openTaskDetail = get<(task: TaskInfo) => void>("openTaskDetail");
  const onCloseAgentPanel = get<() => void>("onCloseAgentPanel");
  const ensureKanbanAgentSession = get<(cwd?: string, provider?: string, modeId?: string, model?: string) => Promise<string | null>>("ensureKanbanAgentSession");
  const kanbanRepoSelection = get<RepoSelection | null>("kanbanRepoSelection");
  const fileChangesOpen = get<boolean>("fileChangesOpen");
  const setFileChangesOpen = get<(open: boolean) => void>("setFileChangesOpen");
  const gitLogOpen = get<boolean>("gitLogOpen");
  const setGitLogOpen = get<(open: boolean) => void>("setGitLogOpen");
  const setShowSettings = get<(value: boolean) => void>("setShowSettings");
  const setLocalTasks = get<(updater: TaskInfo[] | ((current: TaskInfo[]) => TaskInfo[])) => void>("setLocalTasks");
  const closeTaskDetail = get<() => void>("closeTaskDetail");
  const columnSettingSetVisible = get<(visible: string[]) => void>("setVisibleColumns");
  const columnSettingSet = get<(automation: Record<string, ColumnAutomationConfig>) => void>("setColumnAutomation");
  const setVisibleColumns = get<(value: string[]) => void>("setVisibleColumns");
  const onClearAllSetRefresh = get<() => void>("onRefresh");

  const showCreateModal = get<boolean>("showCreateModal");
  const draft = get<TaskDraft>("draft");
  const setDraft = get<(next: TaskDraft) => void>("setDraft");
  const onCloseCreateTask = get<() => void>("onCloseCreateTask");
  const onCreateTask = get<() => void>("onCreateTask");
  const githubAvailable = get<boolean>("githubAvailable");

  const showGitHubImportModal = get<boolean>("showGitHubImportModal");
  const onCloseGitHubImport = get<() => void>("onCloseGitHubImport");
  const onImportGitHubIssues = get<() => void | Promise<void>>("onImportGitHubIssues");
  const onImportGitHubPulls = get<() => void | Promise<void>>("onImportGitHubPulls");
  const localTasks = get<TaskInfo[]>("localTasks");

  const activeSessionId = get<string | null>("activeSessionId");
  const activeTaskId = get<string | null>("activeTaskId");
  const activeTask = get<TaskInfo | null>("activeTask");
  const resolveSpecialist = get<(task: TaskInfo) => unknown>("resolveSpecialist");
  const detailSplitContainerRef = get<React.RefObject<HTMLDivElement>>("detailSplitContainerRef");
  const detailSplitRatio = get<number>("detailSplitRatio");
  const setIsDraggingDetailSplit = get<(dragging: boolean) => void>("setIsDraggingDetailSplit");
  const refreshSignal = get<number | undefined>("refreshSignal");
  const combinedSessions = get<SessionInfo[]>("combinedSessions");
  const setActiveSessionId = get<(id: string | null) => void>("setActiveSessionId");
  const selectedTaskProviderInfo = get<AcpProviderInfo | null>("selectedProvider");
  const isTaskDetailFullscreen = get<boolean>("isTaskDetailFullscreen");
  const onToggleTaskDetailFullscreen = get<(value: boolean) => void>("onToggleTaskDetailFullscreen");

  const selectedCodebase = get<CodebaseData | null>("selectedCodebase");
  const editingCodebase = get<boolean>("editingCodebase");
  const editRepoSelection = get<RepoSelection | null>("editRepoSelection");
  const onRepoSelectionChange = get<(selection: RepoSelection | null) => void | Promise<void>>("onRepoSelectionChange");
  const editError = get<string | null>("editError");
  const recloneError = get<string | null>("recloneError");
  const editSaving = get<boolean>("editSaving");
  const replacingAll = get<boolean>("replacingAll");
  const setShowReplaceAllConfirm = get<(open: boolean) => void>("setShowReplaceAllConfirm");
  const handleCancelEditCodebase = get<() => void>("handleCancelEditCodebase");
  const codebaseWorktrees = get<WorktreeInfo[]>("codebaseWorktrees");
  const worktreeActionError = get<string | null>("worktreeActionError");
  const handleDeleteCodebaseWorktrees = get<(worktrees: WorktreeInfo[]) => void | Promise<void>>("handleDeleteCodebaseWorktrees");
  const deletingWorktreeIds = get<string[]>("deletingWorktreeIds");
  const liveBranchInfo = get<{ current: string; branches: string[] } | null>("liveBranchInfo");
  const branchActionError = get<string | null>("branchActionError");
  const handleDeleteIssueBranch = get<(branch: string) => void | Promise<void>>("handleDeleteIssueBranch");
  const handleDeleteIssueBranches = get<(branches: string[]) => void | Promise<void>>("handleDeleteIssueBranches");
  const deletingBranchNames = get<string[]>("deletingBranchNames");
  const handleReclone = get<() => void | Promise<void>>("handleReclone");
  const recloning = get<boolean>("recloning");
  const recloneSuccess = get<string | null>("recloneSuccess");
  const onStartEditCodebase = get<() => void>("onStartEditCodebase");
  const onRequestRemoveCodebase = get<() => void>("onRequestRemoveCodebase");
  const onCloseCodebaseModal = get<() => void>("onCloseCodebaseModal");

  const showDeleteCodebaseConfirm = get<boolean>("showDeleteCodebaseConfirm");
  const deletingCodebase = get<boolean>("deletingCodebase");
  const onCancelDeleteCodebase = get<() => void>("onCancelDeleteCodebase");
  const onConfirmDeleteCodebase = get<() => void | Promise<void>>("onConfirmDeleteCodebase");

  const showReplaceAllConfirm = get<boolean>("showReplaceAllConfirm");
  const onCancelReplaceAll = get<() => void>("onCancelReplaceAll");
  const onConfirmReplaceAll = get<() => void | Promise<void>>("onConfirmReplaceAll");

  const deleteConfirmTask = get<TaskInfo | null>("deleteConfirmTask");
  const isDeleting = get<boolean>("isDeleting");
  const cancelDeleteTask = get<() => void>("cancelDeleteTask");
  const executeDeleteTask = get<() => Promise<void> | void>("executeDeleteTask");

  const moveBlockedMessage = get<string | null>("moveBlockedMessage");
  const onCloseMoveBlocked = get<() => void>("onCloseMoveBlocked");

  const repoHealth = get<{ missingRepoTasks: number; cwdMismatchTasks: number }>("repoHealth");
  const onRepoClick = get<() => void>("onRepoClick");
  const onFileChangesClick = get<() => void>("onFileChangesClick");
  const onGitLogClick = get<() => void>("onGitLogClick");
  const onProviderClick = get<() => void>("onProviderClick");

  const fileChangesSummary = getKanbanFileChangesSummary(repoChanges);

  const kanbanTabHeaderProps = {
    tasksCount,
    board,
    boardQueue,
    boards,
    selectedBoardId,
    onSelectBoard,
    githubImportEnabled,
    onOpenGitHubImport,
    onRefresh,
    onOpenSettings,
  };

  const kanbanTabHeaderActionProps: KanbanTabHeaderActionProps = {
    board,
    onAgentPrompt,
    availableProviders,
    selectedProviderId,
    onBoardProviderChange,
    disableBoardProvider,
    kanbanTaskAgentCopy,
    agentInput,
    onAgentInputChange,
    onAgentSubmit,
    showCreateTaskModal,
    agentLoading,
    agentSessionId,
    openAgentPanel,
  };

  const boardSurfaceProps = board ? {
    moveError,
    onDismissMoveError,
    codebases,
    workspaceId,
    defaultCodebase,
    repoSync,
    setSelectedCodebase,
    fetchCodebaseWorktrees,
    onRefresh,
    repoChanges,
    repoChangesLoading,
    availableProviders,
    acp,
    boardAutoProviderId,
    kanbanTaskAgentCopy,
    agentSessionId,
    openAgentPanel,
    agentPanelOpen,
    board,
    visibleColumns,
    boardTasks,
    columnAutomation,
    providers,
    specialists,
    specialistLanguage,
    sessionMap,
    liveSessionTails,
    allCodebaseIds,
    worktreeCache,
    queuedPositions,
    dragTaskId,
    setDragTaskId,
    moveTask,
    confirmDeleteTask,
    patchTask,
    retryTaskTrigger,
    runTaskPullRequest,
    openTaskDetail,
    agentSession,
    onCloseAgentPanel,
    ensureKanbanAgentSession,
    kanbanRepoSelection,
    fileChangesOpen,
    setFileChangesOpen,
    gitLogOpen,
    setGitLogOpen,
  } as KanbanTabContentProps["boardSurfaceProps"] : undefined;

  const taskDetailOverlayProps = board ? {
    activeSessionId,
    activeTaskId,
    activeTask,
    board,
    resolveSpecialist,
    acp,
    boardAutoProviderId,
    onBoardProviderChange,
    detailSplitContainerRef,
    detailSplitRatio,
    setIsDraggingDetailSplit,
    refreshSignal,
    availableProviders,
    specialists,
    specialistLanguage,
    codebases,
    allCodebaseIds,
    worktreeCache,
    combinedSessions,
    patchTask,
    retryTaskTrigger,
    runTaskPullRequest,
    confirmDeleteTask,
    onRefresh,
    setActiveSessionId,
    sessionMap,
    workspaceId,
    isTaskDetailFullscreen,
    onToggleTaskDetailFullscreen,
  } as KanbanTabContentProps["taskDetailOverlayProps"] : undefined;

  const createTaskModalProps = {
    showCreateModal,
    draft,
    setDraft,
    onClose: onCloseCreateTask,
    onCreate: onCreateTask,
    githubAvailable,
    codebases,
    allCodebaseIds,
  };

  const githubImportModalProps = {
    show: showGitHubImportModal,
    workspaceId,
    codebases,
    tasks: localTasks,
    onClose: onCloseGitHubImport,
    onImport: onImportGitHubIssues,
    onImportPulls: onImportGitHubPulls,
  };

  const codebaseModalProps = {
    key: selectedCodebase?.id ?? "no-codebase-selected",
    selectedCodebase,
    editingCodebase,
    codebases,
    editRepoSelection,
    onRepoSelectionChange,
    editError,
    recloneError,
    editSaving,
    replacingAll,
    setShowReplaceAllConfirm,
    handleCancelEditCodebase,
    codebaseWorktrees,
    worktreeActionError,
    localTasks,
    handleDeleteCodebaseWorktrees,
    deletingWorktreeIds,
    liveBranchInfo,
    branchActionError,
    handleDeleteIssueBranch,
    handleDeleteIssueBranches,
    deletingBranchNames,
    handleReclone,
    recloning,
    recloneSuccess,
    onStartEditCodebase,
    onRequestRemoveCodebase,
    onClose: onCloseCodebaseModal,
  };

  const deleteCodebaseModalProps = {
    show: showDeleteCodebaseConfirm,
    selectedCodebase,
    editError,
    deletingCodebase,
    onCancel: onCancelDeleteCodebase,
    onConfirm: onConfirmDeleteCodebase,
  };

  const replaceAllReposModalProps = {
    show: showReplaceAllConfirm,
    editRepoSelection,
    codebasesCount: codebases.length,
    recloneError,
    replacingAll,
    onCancel: onCancelReplaceAll,
    onConfirm: onConfirmReplaceAll,
  };

  const deleteTaskModalProps = {
    deleteConfirmTask,
    isDeleting,
    onCancel: cancelDeleteTask,
    onConfirm: executeDeleteTask,
  };

  const moveBlockedModalProps = {
    message: moveBlockedMessage,
    onClose: onCloseMoveBlocked,
  };

  const statusBarProps = {
    defaultCodebase,
    codebases,
    fileChangesSummary,
    board,
    boardQueue,
    repoHealth,
    selectedProvider: selectedTaskProviderInfo,
    onRepoClick,
    onFileChangesClick,
    onGitLogClick,
    onProviderClick,
    fileChangesOpen,
    gitLogOpen,
    repoSync,
  };

  const settingsModalProps = board ? {
    board,
    columnAutomation,
    availableProviders,
    specialists,
    specialistLanguage,
    onClose: () => setShowSettings(false),
    onClearAll: async () => {
      const response = await fetch(`/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to clear tasks");
      }

      setLocalTasks([]);
      closeTaskDetail();
      setShowSettings(false);
      onClearAllSetRefresh();
    },
    onSave: async (
      newColumns,
      newColumnAutomation,
      sessionConcurrencyLimit,
      devSessionSupervision,
    ) => {
      const updatedColumns = newColumns.map((col) => ({
        ...col,
        automation: newColumnAutomation[col.id]?.enabled
          ? normalizeKanbanAutomation(newColumnAutomation[col.id])
          : undefined,
      }));

      const response = await fetch(`/api/kanban/boards/${encodeURIComponent(board.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: updatedColumns, sessionConcurrencyLimit, devSessionSupervision }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to save settings");
      }

      const data = await response.json();
      const updatedBoard = data.board as KanbanBoardInfo | undefined;
      if (updatedBoard) {
        setColumnSettingSet(prev => prev);
      }

      setVisibleColumns(updatedColumns.filter((col) => col.visible !== false).map((col) => col.id));
      columnSettingSet(updatedColumnAutomation(newColumnAutomation as Record<string, ColumnAutomationConfig>));
      setShowSettings(false);
      onClearAllSetRefresh();
    },
  } : undefined;

  return {
    headerProps: kanbanTabHeaderProps,
    headerActionProps: kanbanTabHeaderActionProps,
    boardSurfaceProps,
    createTaskModalProps,
    githubImportModalProps,
    taskDetailOverlayProps,
    showSettingsModal: onOpenSettings !== undefined,
    settingsModalProps,
    codebaseModalProps,
    deleteCodebaseModalProps,
    replaceAllReposModalProps,
    deleteTaskModalProps,
    moveBlockedModalProps,
    statusBarProps,
  };
}
