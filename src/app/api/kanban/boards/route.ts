import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getRoutaSystem } from "@/core/routa-system";
import { createKanbanBoard, getKanbanAutomationSteps } from "@/core/models/kanban";
import { ensureDefaultBoard } from "@/core/kanban/boards";
import { getKanbanSessionConcurrencyLimit } from "@/core/kanban/board-session-limits";
import { getKanbanDevSessionSupervision } from "@/core/kanban/board-session-supervision";
import { getKanbanEventBroadcaster } from "@/core/kanban/kanban-event-broadcaster";
import { getKanbanSessionQueue } from "@/core/kanban/workflow-orchestrator-singleton";
import { processKanbanColumnTransition } from "@/core/kanban/workflow-orchestrator-singleton";

async function reviveMissingEntryAutomations(
  system: ReturnType<typeof getRoutaSystem>,
  workspaceId: string,
  boardId: string,
): Promise<void> {
  const board = await system.kanbanBoardStore.get(boardId);
  if (!board) return;

  const tasks = await system.taskStore.listByWorkspace(workspaceId);
  for (const task of tasks) {
    if (task.boardId !== boardId || task.triggerSessionId || !task.columnId) {
      continue;
    }

    const column = board.columns.find((entry) => entry.id === task.columnId);
    const automation = column?.automation;
    const transitionType = automation?.transitionType ?? "entry";
    const hasLaneSessionForCurrentColumn = (task.laneSessions ?? []).some((entry) => entry.columnId === task.columnId);
    if (
      !automation?.enabled
      || (transitionType !== "entry" && transitionType !== "both")
      || getKanbanAutomationSteps(automation).length === 0
      || hasLaneSessionForCurrentColumn
    ) {
      continue;
    }

    await processKanbanColumnTransition(system, {
      cardId: task.id,
      cardTitle: task.title,
      boardId,
      workspaceId,
      fromColumnId: "__revive__",
      toColumnId: task.columnId,
      fromColumnName: "Revive",
      toColumnName: column?.name,
    });
  }
}

export const dynamic = "force-dynamic";

function requireWorkspaceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(request: NextRequest) {
  const workspaceId = requireWorkspaceId(request.nextUrl.searchParams.get("workspaceId"));
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }
  const system = getRoutaSystem();
  await ensureDefaultBoard(system, workspaceId);
  const boards = await system.kanbanBoardStore.listByWorkspace(workspaceId);
  const workspace = await system.workspaceStore.get(workspaceId);
  const queue = getKanbanSessionQueue(system);
  await Promise.all(boards.map((board) => reviveMissingEntryAutomations(system, workspaceId, board.id)));
  return NextResponse.json({
    boards: await Promise.all(boards.map(async (board) => ({
      ...board,
      sessionConcurrencyLimit: getKanbanSessionConcurrencyLimit(workspace?.metadata, board.id),
      devSessionSupervision: getKanbanDevSessionSupervision(workspace?.metadata, board.id),
      queue: await queue.getBoardSnapshot(board.id),
    }))),
  });
}

export async function POST(request: NextRequest) {
  let body: { workspaceId?: string; name?: string; columns?: ReturnType<typeof createKanbanBoard>["columns"]; isDefault?: boolean };
  try {
    body = await request.json() as { workspaceId?: string; name?: string; columns?: ReturnType<typeof createKanbanBoard>["columns"]; isDefault?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const system = getRoutaSystem();
  const board = createKanbanBoard({
    id: uuidv4(),
    workspaceId,
    name: body.name.trim(),
    isDefault: body.isDefault ?? false,
    columns: body.columns,
  });
  await system.kanbanBoardStore.save(board);
  if (board.isDefault) {
    await system.kanbanBoardStore.setDefault(workspaceId, board.id);
  }
  getKanbanEventBroadcaster().notify({
    workspaceId,
    entity: "board",
    action: "created",
    resourceId: board.id,
    source: "user",
  });
  return NextResponse.json({ board }, { status: 201 });
}
