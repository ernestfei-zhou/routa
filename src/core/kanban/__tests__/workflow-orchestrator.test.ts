import { describe, expect, it, vi } from "vitest";

import { EventBus, AgentEventType } from "../../events/event-bus";
import { createKanbanBoard } from "../../models/kanban";
import { createTask } from "../../models/task";
import { InMemoryKanbanBoardStore } from "../../store/kanban-board-store";
import { InMemoryTaskStore } from "../../store/task-store";
import { KanbanWorkflowOrchestrator } from "../workflow-orchestrator";

describe("KanbanWorkflowOrchestrator", () => {
  it("starts an ACP session when a card enters todo with automation enabled", async () => {
    const eventBus = new EventBus();
    const boardStore = new InMemoryKanbanBoardStore();
    const taskStore = new InMemoryTaskStore();
    const createSession = vi.fn().mockResolvedValue("session-todo-1");

    const board = createKanbanBoard({
      id: "board-1",
      workspaceId: "default",
      name: "Main Board",
      isDefault: true,
      columns: [
        { id: "backlog", name: "Backlog", stage: "backlog", position: 0 },
        {
          id: "todo",
          name: "Todo",
          stage: "todo",
          position: 1,
          automation: {
            enabled: true,
            providerId: "codex",
            role: "DEVELOPER",
            transitionType: "entry",
          },
        },
        { id: "dev", name: "Dev", stage: "dev", position: 2 },
      ],
    });
    await boardStore.save(board);

    const task = createTask({
      id: "task-1",
      title: "Verify todo automation",
      objective: "Ensure moving a card into todo starts ACP automation",
      workspaceId: "default",
      boardId: board.id,
      columnId: "backlog",
    });
    await taskStore.save(task);

    const orchestrator = new KanbanWorkflowOrchestrator(
      eventBus,
      boardStore,
      taskStore,
      createSession,
    );
    orchestrator.start();

    eventBus.emit({
      type: AgentEventType.COLUMN_TRANSITION,
      agentId: "test",
      workspaceId: "default",
      data: {
        cardId: task.id,
        cardTitle: task.title,
        boardId: board.id,
        workspaceId: "default",
        fromColumnId: "backlog",
        toColumnId: "todo",
      },
      timestamp: new Date(),
    });

    await vi.waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        workspaceId: "default",
        cardId: task.id,
        cardTitle: task.title,
        columnId: "todo",
        columnName: "Todo",
        automation: expect.objectContaining({
          enabled: true,
          providerId: "codex",
          role: "DEVELOPER",
          transitionType: "entry",
        }),
      });
    });

    expect(orchestrator.getAutomationForCard(task.id)).toMatchObject({
      cardId: task.id,
      columnId: "todo",
      status: "running",
      sessionId: "session-todo-1",
    });
  });

  it("clears the previous lane session before auto-advancing into the next automation", async () => {
    const eventBus = new EventBus();
    const boardStore = new InMemoryKanbanBoardStore();
    const taskStore = new InMemoryTaskStore();
    const createSession = vi
      .fn()
      .mockResolvedValueOnce("session-backlog-1")
      .mockResolvedValueOnce("session-todo-1");

    const board = createKanbanBoard({
      id: "board-1",
      workspaceId: "default",
      name: "Main Board",
      isDefault: true,
      columns: [
        {
          id: "backlog",
          name: "Backlog",
          stage: "backlog",
          position: 0,
          automation: {
            enabled: true,
            providerId: "claude",
            role: "DEVELOPER",
            transitionType: "entry",
            autoAdvanceOnSuccess: true,
          },
        },
        {
          id: "todo",
          name: "Todo",
          stage: "todo",
          position: 1,
          automation: {
            enabled: true,
            providerId: "codex",
            role: "ROUTA",
            transitionType: "entry",
            autoAdvanceOnSuccess: true,
          },
        },
        { id: "dev", name: "Dev", stage: "dev", position: 2 },
      ],
    });
    await boardStore.save(board);

    const task = createTask({
      id: "task-2",
      title: "Verify chained automation",
      objective: "Ensure each lane gets a fresh session",
      workspaceId: "default",
      boardId: board.id,
      columnId: "backlog",
      triggerSessionId: "session-backlog-1",
    });
    await taskStore.save(task);

    const orchestrator = new KanbanWorkflowOrchestrator(
      eventBus,
      boardStore,
      taskStore,
      createSession,
    );
    orchestrator.start();

    eventBus.emit({
      type: AgentEventType.COLUMN_TRANSITION,
      agentId: "test",
      workspaceId: "default",
      data: {
        cardId: task.id,
        cardTitle: task.title,
        boardId: board.id,
        workspaceId: "default",
        fromColumnId: "inbox",
        toColumnId: "backlog",
      },
      timestamp: new Date(),
    });

    await vi.waitFor(() => {
      expect(createSession).toHaveBeenNthCalledWith(1, expect.objectContaining({
        cardId: task.id,
        columnId: "backlog",
      }));
    });

    eventBus.emit({
      type: AgentEventType.AGENT_COMPLETED,
      agentId: "session-backlog-1",
      workspaceId: "default",
      data: {
        sessionId: "session-backlog-1",
        success: true,
      },
      timestamp: new Date(),
    });

    await vi.waitFor(async () => {
      expect(createSession).toHaveBeenNthCalledWith(2, expect.objectContaining({
        cardId: task.id,
        columnId: "todo",
      }));

      const updatedTask = await taskStore.get(task.id);
      expect(updatedTask).toMatchObject({
        id: task.id,
        columnId: "todo",
        triggerSessionId: undefined,
      });
    });
  });

  it("does not let the previous lane cleanup timer delete the next lane automation", async () => {
    vi.useFakeTimers();

    const eventBus = new EventBus();
    const boardStore = new InMemoryKanbanBoardStore();
    const taskStore = new InMemoryTaskStore();
    const createSession = vi
      .fn()
      .mockResolvedValueOnce("session-backlog-1")
      .mockResolvedValueOnce("session-todo-1");

    const board = createKanbanBoard({
      id: "board-2",
      workspaceId: "default",
      name: "Main Board",
      isDefault: true,
      columns: [
        {
          id: "backlog",
          name: "Backlog",
          stage: "backlog",
          position: 0,
          automation: {
            enabled: true,
            providerId: "claude",
            role: "DEVELOPER",
            transitionType: "entry",
            autoAdvanceOnSuccess: true,
          },
        },
        {
          id: "todo",
          name: "Todo",
          stage: "todo",
          position: 1,
          automation: {
            enabled: true,
            providerId: "codex",
            role: "ROUTA",
            transitionType: "entry",
            autoAdvanceOnSuccess: true,
          },
        },
        { id: "dev", name: "Dev", stage: "dev", position: 2 },
      ],
    });
    await boardStore.save(board);

    const task = createTask({
      id: "task-3",
      title: "Verify automation cleanup isolation",
      objective: "Ensure previous cleanup timers don't delete the next lane entry",
      workspaceId: "default",
      boardId: board.id,
      columnId: "backlog",
      triggerSessionId: "session-backlog-1",
    });
    await taskStore.save(task);

    const orchestrator = new KanbanWorkflowOrchestrator(
      eventBus,
      boardStore,
      taskStore,
      createSession,
    );
    orchestrator.start();

    eventBus.emit({
      type: AgentEventType.COLUMN_TRANSITION,
      agentId: "test",
      workspaceId: "default",
      data: {
        cardId: task.id,
        cardTitle: task.title,
        boardId: board.id,
        workspaceId: "default",
        fromColumnId: "created",
        toColumnId: "backlog",
      },
      timestamp: new Date(),
    });

    await vi.waitFor(() => {
      expect(orchestrator.getAutomationForCard(task.id)).toMatchObject({
        columnId: "backlog",
        sessionId: "session-backlog-1",
      });
    });

    eventBus.emit({
      type: AgentEventType.AGENT_COMPLETED,
      agentId: "session-backlog-1",
      workspaceId: "default",
      data: {
        sessionId: "session-backlog-1",
        success: true,
      },
      timestamp: new Date(),
    });

    await vi.waitFor(() => {
      expect(orchestrator.getAutomationForCard(task.id)).toMatchObject({
        columnId: "todo",
        sessionId: "session-todo-1",
      });
    });

    await vi.advanceTimersByTimeAsync(30_000);

    expect(orchestrator.getAutomationForCard(task.id)).toMatchObject({
      columnId: "todo",
      sessionId: "session-todo-1",
    });

    vi.useRealTimers();
  });
});
