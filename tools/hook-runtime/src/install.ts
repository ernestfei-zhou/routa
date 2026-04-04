#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_HOOKS_PATH = ".husky/_";
const REQUIRED_HOOK_FILES = ["h", "pre-commit", "pre-push", "post-commit"] as const;

export type HookInstallStatus = "synced" | "repaired" | "skipped";

export type HookInstallResult = {
  currentHooksPath: string | null;
  expectedHooksPath: string;
  repoRoot: string | null;
  status: HookInstallStatus;
};

type GitCommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

function runGit(args: string[], cwd: string): GitCommandResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    exitCode: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

export function resolveGitRepoRoot(cwd = process.cwd()): string | null {
  const result = runGit(["rev-parse", "--show-toplevel"], cwd);
  if (result.exitCode !== 0) {
    return null;
  }

  const repoRoot = result.stdout.trim();
  return repoRoot.length > 0 ? repoRoot : null;
}

export function readLocalHooksPath(repoRoot: string): string | null {
  const result = runGit(["config", "--local", "--get", "core.hooksPath"], repoRoot);
  if (result.exitCode !== 0) {
    return null;
  }

  const hooksPath = result.stdout.trim();
  return hooksPath.length > 0 ? hooksPath : null;
}

export function assertTrackedHookRuntime(repoRoot: string): void {
  const missingFiles = REQUIRED_HOOK_FILES.filter((file) => {
    return !fs.existsSync(path.join(repoRoot, EXPECTED_HOOKS_PATH, file));
  });

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing tracked Husky runtime files under ${EXPECTED_HOOKS_PATH}: ${missingFiles.join(", ")}`,
    );
  }
}

export function ensureLocalGitHooks(cwd = process.cwd()): HookInstallResult {
  const repoRoot = resolveGitRepoRoot(cwd);
  if (!repoRoot) {
    return {
      currentHooksPath: null,
      expectedHooksPath: EXPECTED_HOOKS_PATH,
      repoRoot: null,
      status: "skipped",
    };
  }

  assertTrackedHookRuntime(repoRoot);

  const currentHooksPath = readLocalHooksPath(repoRoot);
  if (currentHooksPath === EXPECTED_HOOKS_PATH) {
    return {
      currentHooksPath,
      expectedHooksPath: EXPECTED_HOOKS_PATH,
      repoRoot,
      status: "synced",
    };
  }

  const result = runGit(["config", "--local", "core.hooksPath", EXPECTED_HOOKS_PATH], repoRoot);
  if (result.exitCode !== 0) {
    const details = result.stderr.trim() || result.stdout.trim() || "unknown git config failure";
    throw new Error(`Unable to sync core.hooksPath to ${EXPECTED_HOOKS_PATH}: ${details}`);
  }

  return {
    currentHooksPath,
    expectedHooksPath: EXPECTED_HOOKS_PATH,
    repoRoot,
    status: "repaired",
  };
}

function formatMessage(result: HookInstallResult): string {
  if (result.status === "skipped") {
    return "[hooks:sync] skipped: not inside a git worktree.";
  }

  if (result.status === "synced") {
    return `[hooks:sync] core.hooksPath already matches ${result.expectedHooksPath}.`;
  }

  const from = result.currentHooksPath ?? "<unset>";
  return `[hooks:sync] repaired core.hooksPath: ${from} -> ${result.expectedHooksPath}.`;
}

function main(): void {
  const result = ensureLocalGitHooks();
  console.log(formatMessage(result));
}

const moduleBasename = path.basename(process.argv[1] ?? "");
if (moduleBasename === "install.ts") {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[hooks:sync] ${message}`);
    process.exitCode = 1;
  }
}
