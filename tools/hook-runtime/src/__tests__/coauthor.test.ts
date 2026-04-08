import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  isAgentCoauthorEnforced,
  messageHasTrailer,
  resolveAgentIdentity,
  runCoauthorMode,
} from "../coauthor.js";

describe("coauthor hook runtime", () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const file of tempFiles.splice(0)) {
      try {
        fs.rmSync(file, { force: true });
      } catch {
        // ignore cleanup failures on temp files
      }
    }
  });

  function writeMessage(contents: string): string {
    const file = path.join(os.tmpdir(), `routa-coauthor-${Date.now()}-${Math.random()}.txt`);
    fs.writeFileSync(file, contents, "utf8");
    tempFiles.push(file);
    return file;
  }

  it("detects explicit enforcement via env", () => {
    expect(isAgentCoauthorEnforced({ ROUTA_COAUTHOR_ENFORCE: "1" })).toBe(true);
    expect(isAgentCoauthorEnforced({})).toBe(false);
  });

  it("builds the trailer from agent name and model when explicit coauthor name is absent", () => {
    expect(
      resolveAgentIdentity({
        ROUTA_AGENT_NAME: "Codex",
        ROUTA_AGENT_MODEL: "GPT-5",
        ROUTA_COAUTHOR_EMAIL: "codex@example.test",
      }),
    ).toEqual({
      displayName: "Codex (GPT-5)",
      email: "codex@example.test",
      trailer: "Co-authored-by: Codex (GPT-5) <codex@example.test>",
    });
  });

  it("appends the required trailer during prepare mode", () => {
    const file = writeMessage("feat(test): add hook coverage\n");
    const result = runCoauthorMode("prepare", file, {
      ROUTA_AGENT_NAME: "Codex",
      ROUTA_AGENT_MODEL: "GPT-5",
      ROUTA_COAUTHOR_EMAIL: "codex@example.test",
    });

    expect(result).toEqual({
      status: "updated",
      trailer: "Co-authored-by: Codex (GPT-5) <codex@example.test>",
    });
    expect(
      messageHasTrailer(
        fs.readFileSync(file, "utf8"),
        "Co-authored-by: Codex (GPT-5) <codex@example.test>",
      ),
    ).toBe(true);
  });

  it("fails validation when an enforced agent commit is missing the expected trailer", () => {
    const file = writeMessage("feat(test): add hook coverage\n");
    const result = runCoauthorMode("validate", file, {
      ROUTA_AGENT_NAME: "Codex",
      ROUTA_AGENT_MODEL: "GPT-5",
      ROUTA_COAUTHOR_EMAIL: "codex@example.test",
    });

    expect(result).toEqual({
      status: "failed",
      reason: "Missing required co-author trailer: Co-authored-by: Codex (GPT-5) <codex@example.test>",
    });
  });

  it("skips human-only commits", () => {
    const file = writeMessage("feat(test): human commit\n");
    const result = runCoauthorMode("validate", file, {});

    expect(result).toEqual({
      status: "skipped",
      reason: "Agent co-author enforcement is not active for this commit.",
    });
  });
});
