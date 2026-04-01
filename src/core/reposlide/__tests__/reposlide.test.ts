import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { scanRepoTree, computeSummary } from "../scan-codebase-tree";
import { buildRepoBuildDeck } from "../build-reposlide-deck";
import type { Codebase } from "@/core/models/codebase";

/** Create a small fixture directory tree for testing. */
function createFixtureDir(): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "reposlide-test-"));

  fs.mkdirSync(path.join(base, "src"));
  fs.mkdirSync(path.join(base, "src", "app"));
  fs.mkdirSync(path.join(base, "src", "core"));
  fs.mkdirSync(path.join(base, "docs"));
  fs.mkdirSync(path.join(base, "crates"));

  fs.writeFileSync(path.join(base, "README.md"), "# Test");
  fs.writeFileSync(path.join(base, "AGENTS.md"), "agents");
  fs.writeFileSync(path.join(base, "package.json"), "{}");
  fs.writeFileSync(path.join(base, "src", "index.ts"), "export {}");
  fs.writeFileSync(path.join(base, "src", "app", "page.tsx"), "<Page />");
  fs.writeFileSync(path.join(base, "src", "core", "utils.ts"), "export {}");
  fs.writeFileSync(path.join(base, "docs", "guide.md"), "# Guide");

  return base;
}

function removeFixtureDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("scanRepoTree", () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir();
  });

  afterAll(() => {
    removeFixtureDir(fixtureDir);
  });

  it("scans directory and returns a tree with correct types", () => {
    const tree = scanRepoTree(fixtureDir);
    expect(tree.type).toBe("directory");
    expect(tree.children).toBeDefined();
    expect(tree.children!.length).toBeGreaterThan(0);
  });

  it("counts files correctly", () => {
    const tree = scanRepoTree(fixtureDir);
    expect(tree.fileCount).toBe(7);
  });

  it("sorts directories before files", () => {
    const tree = scanRepoTree(fixtureDir);
    const types = tree.children!.map((c) => c.type);
    const firstFileIndex = types.indexOf("file");
    const lastDirIndex = types.lastIndexOf("directory");
    if (firstFileIndex >= 0 && lastDirIndex >= 0) {
      expect(lastDirIndex).toBeLessThan(firstFileIndex);
    }
  });

  it("skips ignored directories", () => {
    const nodeModulesDir = path.join(fixtureDir, "node_modules");
    fs.mkdirSync(nodeModulesDir);
    fs.writeFileSync(path.join(nodeModulesDir, "pkg.js"), "");

    const tree = scanRepoTree(fixtureDir);
    const names = tree.children!.map((c) => c.name);
    expect(names).not.toContain("node_modules");

    fs.rmSync(nodeModulesDir, { recursive: true });
  });
});

describe("computeSummary", () => {
  it("returns correct file and directory counts", () => {
    const fixtureDir = createFixtureDir();
    const tree = scanRepoTree(fixtureDir);
    const summary = computeSummary(tree, "local", "main");

    expect(summary.totalFiles).toBe(7);
    expect(summary.totalDirectories).toBeGreaterThan(0);
    expect(summary.topLevelFolders).toContain("src");
    expect(summary.topLevelFolders).toContain("docs");
    expect(summary.sourceType).toBe("local");
    expect(summary.branch).toBe("main");

    removeFixtureDir(fixtureDir);
  });
});

describe("buildRepoBuildDeck", () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir();
  });

  afterAll(() => {
    removeFixtureDir(fixtureDir);
  });

  it("generates a complete deck with all expected slide types", () => {
    const codebase: Codebase = {
      id: "cb-1",
      workspaceId: "ws-1",
      repoPath: fixtureDir,
      branch: "main",
      label: "test-repo",
      isDefault: true,
      sourceType: "local",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const deck = buildRepoBuildDeck(codebase);

    expect(deck.codebase.id).toBe("cb-1");
    expect(deck.codebase.label).toBe("test-repo");
    expect(deck.summary.totalFiles).toBe(7);
    expect(deck.slides.length).toBeGreaterThanOrEqual(3);

    const slideTypes = deck.slides.map((s) => s.type);
    expect(slideTypes).toContain("overview");
    expect(slideTypes).toContain("top-level-structure");
    expect(slideTypes).toContain("entry-points");
  });

  it("includes directory focus slides for top-level directories", () => {
    const codebase: Codebase = {
      id: "cb-2",
      workspaceId: "ws-1",
      repoPath: fixtureDir,
      branch: "main",
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const deck = buildRepoBuildDeck(codebase);
    const dirFocusSlides = deck.slides.filter((s) => s.type === "directory-focus");
    expect(dirFocusSlides.length).toBeGreaterThan(0);
  });

  it("detects key files at root level", () => {
    const codebase: Codebase = {
      id: "cb-3",
      workspaceId: "ws-1",
      repoPath: fixtureDir,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const deck = buildRepoBuildDeck(codebase);
    const keyFilesSlide = deck.slides.find((s) => s.type === "key-files");
    expect(keyFilesSlide).toBeDefined();
    const files = (keyFilesSlide!.content as { files: { name: string }[] }).files;
    expect(files.some((f) => f.name === "README.md")).toBe(true);
    expect(files.some((f) => f.name === "AGENTS.md")).toBe(true);
  });

  it("overview slide has correct content shape", () => {
    const codebase: Codebase = {
      id: "cb-4",
      workspaceId: "ws-1",
      repoPath: fixtureDir,
      branch: "develop",
      label: "my-repo",
      isDefault: true,
      sourceType: "github",
      sourceUrl: "https://github.com/example/repo",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const deck = buildRepoBuildDeck(codebase);
    const overview = deck.slides.find((s) => s.type === "overview");
    expect(overview).toBeDefined();
    expect(overview!.content.label).toBe("my-repo");
    expect(overview!.content.branch).toBe("develop");
    expect(overview!.content.sourceType).toBe("github");
    expect(overview!.content.totalFiles).toBe(7);
  });
});
