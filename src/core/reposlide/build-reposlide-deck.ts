/**
 * Build a slide deck from a scanned repository tree.
 *
 * Generates a fixed set of auto-generated slide types:
 * 1. Repository Overview
 * 2. Top-level Structure
 * 3. Entry Points / Architecture Anchors
 * 4. Directory Focus Slides (one per important top-level directory)
 * 5. Key Files Slide
 */

import type { Codebase } from "@/core/models/codebase";
import {
  scanRepoTree,
  computeSummary,
  type RepoTreeNode,
  type RepoSummary,
} from "./scan-codebase-tree";

/** The type of slide in the deck. */
export type SlideType =
  | "overview"
  | "top-level-structure"
  | "entry-points"
  | "directory-focus"
  | "key-files";

/** A single slide in the deck. */
export interface RepoSlide {
  id: string;
  type: SlideType;
  title: string;
  content: Record<string, unknown>;
}

/** The full slide deck response shape. */
export interface RepoSlideDeck {
  codebase: {
    id: string;
    label?: string;
    repoPath: string;
    sourceType: string;
    branch?: string;
  };
  summary: RepoSummary;
  tree: RepoTreeNode;
  slides: RepoSlide[];
}

/** Well-known entry-point / anchor file patterns. */
const ENTRY_POINT_PATTERNS = [
  "README.md",
  "README",
  "AGENTS.md",
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "setup.py",
  "pom.xml",
  "build.gradle",
  "Makefile",
  "Dockerfile",
  "docker-compose.yml",
  "tsconfig.json",
];

/** Directories that often serve as architecture anchors. */
const ANCHOR_DIRS = [
  "src/app",
  "src/core",
  "src/client",
  "crates",
  "apps",
  "lib",
  "pkg",
  "cmd",
  "internal",
  "api",
];

/** Maximum number of directory-focus slides. */
const MAX_DIR_FOCUS_SLIDES = 6;

/**
 * Build a complete RepoSlide deck for a codebase.
 */
export function buildRepoBuildDeck(codebase: Codebase): RepoSlideDeck {
  const tree = scanRepoTree(codebase.repoPath);
  const sourceType = codebase.sourceType ?? "local";
  const summary = computeSummary(tree, sourceType, codebase.branch);

  const slides: RepoSlide[] = [];

  // 1. Overview slide
  slides.push(buildOverviewSlide(codebase, summary));

  // 2. Top-level structure slide
  slides.push(buildTopLevelStructureSlide(tree));

  // 3. Entry points / architecture anchors slide
  const entryPoints = detectEntryPoints(tree);
  if (entryPoints.length > 0) {
    slides.push(buildEntryPointsSlide(entryPoints));
  }

  // 4. Directory focus slides
  const focusDirs = pickFocusDirectories(tree);
  for (const dir of focusDirs) {
    slides.push(buildDirectoryFocusSlide(dir));
  }

  // 5. Key files slide
  const keyFiles = detectKeyFiles(tree);
  if (keyFiles.length > 0) {
    slides.push(buildKeyFilesSlide(keyFiles));
  }

  return {
    codebase: {
      id: codebase.id,
      label: codebase.label,
      repoPath: codebase.repoPath,
      sourceType,
      branch: codebase.branch,
    },
    summary,
    tree,
    slides,
  };
}

/* ─── Slide builders ──────────────────────────────────────────── */

function buildOverviewSlide(codebase: Codebase, summary: RepoSummary): RepoSlide {
  return {
    id: "overview",
    type: "overview",
    title: "Repository Overview",
    content: {
      label: codebase.label ?? codebase.repoPath.split("/").pop(),
      repoPath: codebase.repoPath,
      branch: codebase.branch ?? "unknown",
      sourceType: codebase.sourceType ?? "local",
      totalFiles: summary.totalFiles,
      totalDirectories: summary.totalDirectories,
    },
  };
}

function buildTopLevelStructureSlide(tree: RepoTreeNode): RepoSlide {
  const dirs = (tree.children ?? [])
    .filter((c) => c.type === "directory")
    .map((c) => ({
      name: c.name,
      fileCount: c.fileCount ?? 0,
    }));

  const files = (tree.children ?? [])
    .filter((c) => c.type === "file")
    .map((c) => c.name);

  return {
    id: "top-level-structure",
    type: "top-level-structure",
    title: "Top-level Structure",
    content: {
      directories: dirs,
      rootFiles: files,
    },
  };
}

function buildEntryPointsSlide(entryPoints: { name: string; path: string; reason: string }[]): RepoSlide {
  return {
    id: "entry-points",
    type: "entry-points",
    title: "Entry Points & Architecture Anchors",
    content: {
      entryPoints,
    },
  };
}

function buildDirectoryFocusSlide(dir: RepoTreeNode): RepoSlide {
  return {
    id: `dir-focus-${dir.name}`,
    type: "directory-focus",
    title: dir.name,
    content: {
      path: dir.path,
      fileCount: dir.fileCount ?? 0,
      children: (dir.children ?? []).map((c) => ({
        name: c.name,
        type: c.type,
        fileCount: c.type === "directory" ? (c.fileCount ?? 0) : undefined,
      })),
    },
  };
}

function buildKeyFilesSlide(keyFiles: { name: string; path: string }[]): RepoSlide {
  return {
    id: "key-files",
    type: "key-files",
    title: "Key Files",
    content: {
      files: keyFiles,
    },
  };
}

/* ─── Detection helpers ───────────────────────────────────────── */

function detectEntryPoints(tree: RepoTreeNode): { name: string; path: string; reason: string }[] {
  const found: { name: string; path: string; reason: string }[] = [];

  // Check root-level files
  for (const child of tree.children ?? []) {
    if (child.type === "file") {
      for (const pattern of ENTRY_POINT_PATTERNS) {
        if (child.name === pattern || child.name.startsWith(pattern.split(".")[0])) {
          found.push({ name: child.name, path: child.path, reason: `Project entry point (${pattern})` });
          break;
        }
      }
    }
  }

  // Check anchor directories
  for (const anchor of ANCHOR_DIRS) {
    const node = findNodeByPath(tree, anchor);
    if (node) {
      found.push({
        name: anchor,
        path: node.path,
        reason: `Architecture anchor directory`,
      });
    }
  }

  return found;
}

function detectKeyFiles(tree: RepoTreeNode): { name: string; path: string }[] {
  const keyPatterns = [
    "README.md",
    "AGENTS.md",
    "ARCHITECTURE.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "CHANGELOG.md",
  ];
  const found: { name: string; path: string }[] = [];

  for (const child of tree.children ?? []) {
    if (child.type === "file" && keyPatterns.some((p) => child.name === p)) {
      found.push({ name: child.name, path: child.path });
    }
  }

  return found;
}

function pickFocusDirectories(tree: RepoTreeNode): RepoTreeNode[] {
  return (tree.children ?? [])
    .filter((c) => c.type === "directory")
    .sort((a, b) => (b.fileCount ?? 0) - (a.fileCount ?? 0))
    .slice(0, MAX_DIR_FOCUS_SLIDES);
}

function findNodeByPath(tree: RepoTreeNode, targetPath: string): RepoTreeNode | null {
  const segments = targetPath.split("/");
  let current: RepoTreeNode | undefined = tree;

  for (const segment of segments) {
    if (!current?.children) return null;
    current = current.children.find((c) => c.name === segment);
    if (!current) return null;
  }

  return current;
}
