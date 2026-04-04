import { describe, expect, it } from "vitest";

import path from "node:path";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { ensureLocalGitHooks } from "../install.js";

function withTempRepo<T>(run: (repoRoot: string) => T): T {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "routa-hooks-sync-"));

  try {
    execSync("git init", { cwd: repoRoot, stdio: "ignore" });
    mkdirSync(path.join(repoRoot, ".husky", "_"), { recursive: true });
    writeFileSync(path.join(repoRoot, ".husky", "_", "h"), "#!/usr/bin/env sh\n", "utf8");
    writeFileSync(path.join(repoRoot, ".husky", "_", "pre-commit"), "#!/usr/bin/env sh\n", "utf8");
    writeFileSync(path.join(repoRoot, ".husky", "_", "pre-push"), "#!/usr/bin/env sh\n", "utf8");
    writeFileSync(path.join(repoRoot, ".husky", "_", "post-commit"), "#!/usr/bin/env sh\n", "utf8");
    return run(repoRoot);
  } finally {
    rmSync(repoRoot, { force: true, recursive: true });
  }
}

function readHooksPath(repoRoot: string): string {
  return execSync("git config --local --get core.hooksPath", {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

describe("ensureLocalGitHooks", () => {
  it("repairs a drifted core.hooksPath", () => {
    withTempRepo((repoRoot) => {
      execSync("git config --local core.hooksPath /tmp/routa-test-hooks", {
        cwd: repoRoot,
        stdio: "ignore",
      });

      const result = ensureLocalGitHooks(repoRoot);

      expect(result.status).toBe("repaired");
      expect(result.currentHooksPath).toBe("/tmp/routa-test-hooks");
      expect(readHooksPath(repoRoot)).toBe(".husky/_");
    });
  });

  it("does not rewrite config when hooksPath is already correct", () => {
    withTempRepo((repoRoot) => {
      execSync("git config --local core.hooksPath .husky/_", {
        cwd: repoRoot,
        stdio: "ignore",
      });

      const result = ensureLocalGitHooks(repoRoot);

      expect(result.status).toBe("synced");
      expect(result.currentHooksPath).toBe(".husky/_");
      expect(readHooksPath(repoRoot)).toBe(".husky/_");
    });
  });

  it("fails fast when the tracked husky runtime is missing", () => {
    withTempRepo((repoRoot) => {
      rmSync(path.join(repoRoot, ".husky", "_", "pre-push"), { force: true });

      expect(() => ensureLocalGitHooks(repoRoot)).toThrow(
        "Missing tracked Husky runtime files under .husky/_: pre-push",
      );
    });
  });
});
