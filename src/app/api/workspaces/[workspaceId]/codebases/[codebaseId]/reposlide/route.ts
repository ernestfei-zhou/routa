/**
 * GET /api/workspaces/[workspaceId]/codebases/[codebaseId]/reposlide
 *
 * Returns an auto-generated slide deck for the given codebase.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { buildRepoBuildDeck } from "@/core/reposlide/build-reposlide-deck";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const system = getRoutaSystem();

  const codebase = await system.codebaseStore.get(codebaseId);
  if (!codebase || codebase.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Codebase not found" }, { status: 404 });
  }

  if (!codebase.repoPath) {
    return NextResponse.json(
      { error: "Codebase has no repository path" },
      { status: 400 },
    );
  }

  try {
    const deck = buildRepoBuildDeck(codebase);
    return NextResponse.json(deck);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
