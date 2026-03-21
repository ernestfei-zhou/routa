/**
 * @vitest-environment node
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SessionUpdateNotification } from "../http-session-store";
import { getHttpSessionStore } from "../http-session-store";
import { appendSessionNotificationEvent, hasUserMessageInHistory } from "../session-db-persister";
import { LocalSessionProvider } from "../../storage/local-session-provider";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "session-db-persister-"));
  process.env.HOME = tmpDir;
});

afterEach(async () => {
  const store = getHttpSessionStore();
  for (const session of store.listSessions()) {
    store.deleteSession(session.sessionId);
  }

  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("session-db-persister", () => {
  it("detects persisted user prompts in session history", () => {
    const history: SessionUpdateNotification[] = [
      {
        sessionId: "session-1",
        update: {
          sessionUpdate: "acp_status",
          status: "ready",
        },
      } as SessionUpdateNotification,
      {
        sessionId: "session-1",
        update: {
          sessionUpdate: "user_message",
          content: { type: "text", text: "hello" },
        },
      } as SessionUpdateNotification,
    ];

    expect(hasUserMessageInHistory(history)).toBe(true);
  });

  it("returns false when no user prompt has been stored", () => {
    const history: SessionUpdateNotification[] = [
      {
        sessionId: "session-1",
        update: {
          sessionUpdate: "acp_status",
          status: "ready",
        },
      } as SessionUpdateNotification,
    ];

    expect(hasUserMessageInHistory(history)).toBe(false);
  });

  it("appends session notifications to the local JSONL event log", async () => {
    const projectPath = path.join(tmpDir, "project");
    const sessionId = "session-jsonl";
    const store = getHttpSessionStore();
    store.upsertSession({
      sessionId,
      cwd: projectPath,
      workspaceId: "ws-1",
      provider: "opencode",
      createdAt: new Date().toISOString(),
    });

    const notification: SessionUpdateNotification = {
      sessionId,
      update: {
        sessionUpdate: "agent_message",
        content: { type: "text", text: "hello from jsonl" },
      },
    };

    await appendSessionNotificationEvent(sessionId, notification);

    const history = await new LocalSessionProvider(projectPath).getHistory(sessionId);
    expect(history).toHaveLength(1);
    expect((history[0] as { message: SessionUpdateNotification }).message).toEqual(notification);
  });
});
