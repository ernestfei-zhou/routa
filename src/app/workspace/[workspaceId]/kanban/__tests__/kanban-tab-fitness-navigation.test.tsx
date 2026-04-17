import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KanbanTab } from "../kanban-tab";
import type { KanbanBoardInfo, TaskInfo } from "../../types";
import { resetDesktopAwareFetchToGlobalFetch } from "./test-utils";

const { desktopAwareFetch } = vi.hoisted(() => ({
  desktopAwareFetch: vi.fn(),
}));

vi.mock("@/client/utils/diagnostics", async () => {
  const actual = await vi.importActual<typeof import("@/client/utils/diagnostics")>("@/client/utils/diagnostics");
  return {
    ...actual,
    desktopAwareFetch,
  };
});

vi.mock("@/client/components/repo-picker", () => ({
  RepoPicker: () => <div data-testid="repo-picker-mock" />,
}));

vi.mock("../use-runtime-fitness-status", async () => {
  const { mockUseRuntimeFitnessStatus } = await import("./test-utils");
  return {
    useRuntimeFitnessStatus: mockUseRuntimeFitnessStatus,
  };
});

const board: KanbanBoardInfo = {
  id: "board-1",
  workspaceId: "workspace-1",
  name: "Default Board",
  isDefault: true,
  sessionConcurrencyLimit: 1,
  queue: {
    runningCount: 0,
    runningCards: [],
    queuedCount: 0,
    queuedCardIds: [],
    queuedCards: [],
    queuedPositions: {},
  },
  columns: [
    { id: "backlog", name: "Backlog", position: 0, stage: "backlog" },
  ],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function createTask(id: string, title: string, overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id,
    title,
    objective: `${title} objective`,
    status: "PENDING",
    boardId: board.id,
    columnId: "backlog",
    position: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  resetDesktopAwareFetchToGlobalFetch(desktopAwareFetch);
  desktopAwareFetch.mockImplementation(
    () => new Promise<Response>(() => {}),
  );
  window.history.replaceState({}, "", "/workspace/workspace-1/kanban");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KanbanTab fitness navigation", () => {
  it("opens the live kanban fitness canvas instead of fluency settings", () => {
    const assignSpy = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      assign: assignSpy,
    });

    render(
      <KanbanTab
        workspaceId="workspace-1"
        boards={[board]}
        tasks={[createTask("task-1", "Story One")]}
        sessions={[]}
        providers={[]}
        specialists={[]}
        codebases={[{
          id: "codebase-1",
          workspaceId: "workspace-1",
          repoPath: "/tmp/repo",
          branch: "main",
          label: "routa-js",
          isDefault: true,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        }]}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("kanban-runtime-fitness-status"));

    expect(assignSpy).toHaveBeenCalledWith(
      "/workspace/workspace-1/kanban/fitness?codebaseId=codebase-1",
    );
  });
});
