"use client";

/**
 * RepoSlide Page Client — Interactive slide-deck style repository visualization.
 *
 * Route: /workspace/[workspaceId]/codebases/[codebaseId]/reposlide
 *
 * Features:
 * - Full-page slide canvas
 * - Left/right navigation controls
 * - Keyboard navigation (ArrowLeft/Right, Home/End, Escape, f)
 * - Current slide index / total
 * - Fullscreen / presentation mode toggle
 */

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DesktopAppShell } from "@/client/components/desktop-app-shell";
import { desktopAwareFetch } from "@/client/utils/diagnostics";

/* ─── Types ──────────────────────────────────────────────────── */

interface RepoSlideData {
  id: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
}

interface RepoDeckResponse {
  codebase: {
    id: string;
    label?: string;
    repoPath: string;
    sourceType: string;
    branch?: string;
  };
  summary: {
    totalFiles: number;
    totalDirectories: number;
    topLevelFolders: string[];
    sourceType: string;
    branch?: string;
  };
  slides: RepoSlideData[];
}

/* ─── Main Client Component ──────────────────────────────────── */

export function RepoSlidePageClient() {
  const params = useParams<{ workspaceId: string; codebaseId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const codebaseId = params.codebaseId;

  const [deck, setDeck] = useState<RepoDeckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch deck data
  useEffect(() => {
    if (!workspaceId || !codebaseId) return;

    let cancelled = false;

    const fetchDeck = async () => {
      try {
        const res = await desktopAwareFetch(
          `/api/workspaces/${workspaceId}/codebases/${codebaseId}/reposlide`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: RepoDeckResponse = await res.json();
        if (!cancelled) {
          setDeck(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };

    void fetchDeck();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, codebaseId]);

  const totalSlides = deck?.slides.length ?? 0;

  const goTo = useCallback(
    (index: number) => {
      setCurrentSlide(Math.max(0, Math.min(index, totalSlides - 1)));
    },
    [totalSlides],
  );

  const goPrev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);
  const goNext = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          goPrev();
          break;
        case "ArrowRight":
          goNext();
          break;
        case "Home":
          goTo(0);
          break;
        case "End":
          goTo(totalSlides - 1);
          break;
        case "Escape":
          if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
          break;
        case "f":
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            toggleFullscreen();
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext, goTo, totalSlides, isFullscreen, toggleFullscreen]);

  const content = (
    <div className="flex h-full flex-col bg-desktop-bg-primary" data-testid="reposlide-root">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-desktop-border px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-xs text-desktop-text-secondary hover:text-desktop-text-primary"
          >
            ← Back
          </button>
          <span className="text-sm font-semibold text-desktop-text-primary">
            RepoSlide
          </span>
          {deck && (
            <span className="text-xs text-desktop-text-secondary">
              {deck.codebase.label ?? deck.codebase.repoPath.split("/").pop()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalSlides > 0 && (
            <span className="text-xs text-desktop-text-secondary" data-testid="slide-counter">
              {currentSlide + 1} / {totalSlides}
            </span>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md border border-desktop-border px-2 py-1 text-xs text-desktop-text-secondary hover:bg-desktop-bg-active"
            title="Toggle fullscreen (f)"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Slide area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {loading && (
          <div className="text-sm text-desktop-text-secondary">Loading deck…</div>
        )}
        {error && (
          <div className="text-sm text-rose-500">Error: {error}</div>
        )}
        {!loading && !error && deck && totalSlides > 0 && (
          <SlideCanvas slide={deck.slides[currentSlide]} />
        )}
        {!loading && !error && totalSlides === 0 && (
          <div className="text-sm text-desktop-text-secondary">
            No slides available for this codebase.
          </div>
        )}

        {/* Navigation arrows */}
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={currentSlide === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-desktop-border bg-desktop-bg-primary/80 p-2 text-desktop-text-secondary transition hover:bg-desktop-bg-active disabled:opacity-30"
              aria-label="Previous slide"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={currentSlide === totalSlides - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-desktop-border bg-desktop-bg-primary/80 p-2 text-desktop-text-secondary transition hover:bg-desktop-bg-active disabled:opacity-30"
              aria-label="Next slide"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Thumbnail rail */}
      {totalSlides > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-desktop-border px-4 py-2">
          {deck!.slides.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(idx)}
              className={`shrink-0 rounded-md border px-2 py-1 text-[10px] transition ${
                idx === currentSlide
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-desktop-border text-desktop-text-secondary hover:bg-desktop-bg-active"
              }`}
            >
              {slide.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <DesktopAppShell workspaceId={workspaceId}>
      {content}
    </DesktopAppShell>
  );
}

/* ─── Slide Canvas ───────────────────────────────────────────── */

function SlideCanvas({ slide }: { slide: RepoSlideData }) {
  return (
    <div
      className="mx-auto w-full max-w-4xl rounded-2xl border border-desktop-border bg-white p-8 shadow-sm dark:bg-[#12141c]"
      data-testid="slide-canvas"
    >
      <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {slide.title}
      </h2>
      <SlideContent type={slide.type} content={slide.content} />
    </div>
  );
}

/* ─── Slide Content Renderers ────────────────────────────────── */

function SlideContent({ type, content }: { type: string; content: Record<string, unknown> }) {
  switch (type) {
    case "overview":
      return <OverviewSlide content={content} />;
    case "top-level-structure":
      return <TopLevelStructureSlide content={content} />;
    case "entry-points":
      return <EntryPointsSlide content={content} />;
    case "directory-focus":
      return <DirectoryFocusSlide content={content} />;
    case "key-files":
      return <KeyFilesSlide content={content} />;
    default:
      return (
        <pre className="text-xs text-slate-500">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
  }
}

function OverviewSlide({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800/50">
        <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          {content.label as string}
        </div>
        <div className="mt-1 font-mono text-xs text-slate-500">{content.repoPath as string}</div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Files" value={content.totalFiles as number} />
        <StatCard label="Directories" value={content.totalDirectories as number} />
        <StatCard label="Branch" value={content.branch as string} />
        <StatCard label="Source" value={content.sourceType as string} />
      </div>
    </div>
  );
}

function TopLevelStructureSlide({ content }: { content: Record<string, unknown> }) {
  const dirs = content.directories as { name: string; fileCount: number }[];
  const rootFiles = content.rootFiles as string[];

  return (
    <div className="space-y-4">
      {dirs?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Directories
          </h3>
          <div className="space-y-1.5">
            {dirs.map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 dark:text-slate-300">📁 {d.name}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-400 dark:bg-blue-600"
                    style={{
                      width: `${Math.min(100, (d.fileCount / Math.max(1, ...dirs.map((x) => x.fileCount))) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-slate-400">{d.fileCount} files</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {rootFiles?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Root Files
          </h3>
          <div className="flex flex-wrap gap-2">
            {rootFiles.map((f) => (
              <span
                key={f}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EntryPointsSlide({ content }: { content: Record<string, unknown> }) {
  const entryPoints = content.entryPoints as { name: string; path: string; reason: string }[];

  return (
    <div className="space-y-3">
      {entryPoints?.map((ep) => (
        <div
          key={ep.path}
          className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
        >
          <div className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
            {ep.name}
          </div>
          <div className="mt-1 text-xs text-slate-500">{ep.reason}</div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-400">{ep.path}</div>
        </div>
      ))}
    </div>
  );
}

function DirectoryFocusSlide({ content }: { content: Record<string, unknown> }) {
  const children = content.children as { name: string; type: string; fileCount?: number }[];
  const fileCount = content.fileCount as number;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          {fileCount} files
        </span>
        <span className="font-mono text-xs text-slate-400">{content.path as string}</span>
      </div>
      {children?.length > 0 && (
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {children.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-1.5 dark:border-slate-800"
            >
              <span className="text-xs">{c.type === "directory" ? "📁" : "📄"}</span>
              <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-300">
                {c.name}
              </span>
              {c.type === "directory" && c.fileCount != null && (
                <span className="text-[10px] text-slate-400">{c.fileCount}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyFilesSlide({ content }: { content: Record<string, unknown> }) {
  const files = content.files as { name: string; path: string }[];

  return (
    <div className="space-y-2">
      {files?.map((f) => (
        <div
          key={f.path}
          className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
        >
          <div className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
            📄 {f.name}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-400">{f.path}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Shared UI helpers ──────────────────────────────────────── */

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center dark:border-slate-700">
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}
