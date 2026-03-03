"use client";

/**
 * WorkspaceSidebar - Left navigation panel
 * 
 * Shows workspaces with their recent sessions in a collapsible tree structure.
 * Sorted by most recently updated.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SessionInfo {
  sessionId: string;
  name?: string;
  cwd: string;
  workspaceId: string;
  provider?: string;
  role?: string;
  createdAt: string;
}

interface WorkspaceWithSessions {
  id: string;
  title: string;
  updatedAt: string;
  sessions: SessionInfo[];
}

interface WorkspaceSidebarProps {
  activeWorkspaceId?: string | null;
  onWorkspaceCreate?: (title: string) => void;
}

export function WorkspaceSidebar({ activeWorkspaceId, onWorkspaceCreate }: WorkspaceSidebarProps) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithSessions[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkspacesWithSessions();
  }, []);

  const fetchWorkspacesWithSessions = async () => {
    try {
      setLoading(true);
      const wsRes = await fetch("/api/workspaces");
      const wsData = await wsRes.json();
      const workspacesList = wsData.workspaces || [];

      // Fetch sessions for each workspace
      const withSessions = await Promise.all(
        workspacesList.map(async (ws: any) => {
          try {
            const sessRes = await fetch(`/api/sessions?workspaceId=${ws.id}&limit=5`);
            const sessData = await sessRes.json();
            return {
              ...ws,
              sessions: sessData.sessions || [],
            };
          } catch {
            return { ...ws, sessions: [] };
          }
        })
      );

      // Sort by most recently updated
      withSessions.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setWorkspaces(withSessions);
      
      // Auto-expand active workspace
      if (activeWorkspaceId) {
        setExpandedIds(new Set([activeWorkspaceId]));
      }
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (wsId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) {
        next.delete(wsId);
      } else {
        next.add(wsId);
      }
      return next;
    });
  };

  const formatTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const getSessionDisplayName = (s: SessionInfo) => {
    if (s.name) return s.name;
    if (s.provider && s.role) return `${s.provider} · ${s.role.toLowerCase()}`;
    if (s.provider) return s.provider;
    return `Session ${s.sessionId.slice(0, 6)}`;
  };

  if (loading) {
    return (
      <div className="w-60 border-r border-gray-200 dark:border-[#1c1f2e] bg-gray-50 dark:bg-[#0d0f15] flex items-center justify-center">
        <div className="text-xs text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-60 border-r border-gray-200 dark:border-[#1c1f2e] bg-gray-50 dark:bg-[#0d0f15] flex flex-col">
      {/* Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-gray-200 dark:border-[#1c1f2e]">
        <h2 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Workspaces
        </h2>
      </div>

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {workspaces.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              No workspaces yet
            </p>
            <button
              onClick={() => onWorkspaceCreate?.("My Workspace")}
              className="text-xs text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
            >
              Create one →
            </button>
          </div>
        ) : (
          workspaces.map((ws) => {
            const isExpanded = expandedIds.has(ws.id);
            const isActive = ws.id === activeWorkspaceId;

            return (
              <div key={ws.id} className="space-y-0.5">
                {/* Workspace row */}
                <div
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? "bg-amber-100 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#151720]"
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(ws.id)}
                    className="shrink-0 w-4 h-4 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg
                      className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <a
                    href={`/workspace/${ws.id}`}
                    className="flex-1 flex items-center gap-2 min-w-0"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/workspace/${ws.id}`);
                    }}
                  >
                    <svg
                      className="shrink-0 w-3.5 h-3.5 opacity-50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
                      />
                    </svg>
                    <span className="text-xs font-medium truncate">{ws.title}</span>
                  </a>

                  <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-600 font-mono">
                    {formatTime(ws.updatedAt)}
                  </span>
                </div>

                {/* Sessions (when expanded) */}
                {isExpanded && ws.sessions.length > 0 && (
                  <div className="ml-5 space-y-0.5">
                    {ws.sessions.map((session) => (
                      <button
                        key={session.sessionId}
                        onClick={() => router.push(`/workspace/${ws.id}/sessions/${session.sessionId}`)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#151720] hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                      >
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500" />
                        <span className="flex-1 truncate text-left">
                          {getSessionDisplayName(session)}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-600 font-mono">
                          {formatTime(session.createdAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create new workspace button */}
      {workspaces.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-[#1c1f2e]">
          <button
            onClick={() => onWorkspaceCreate?.("New Workspace")}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#151720] hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Workspace
          </button>
        </div>
      )}
    </div>
  );
}
