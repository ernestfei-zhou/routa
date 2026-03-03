"use client";

/**
 * Routa JS - Home Page
 *
 * Task-first, operational layout:
 * - Input dominates the viewport — type immediately
 * - Agent selection is lightweight (dropdown in control bar)
 * - Context (Workspace / Repo) structured in input's bottom bar
 * - Skills shown as scannable grid cards
 * - Recent sessions as compact inline pills
 */

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeInput } from "@/client/components/home-input";
import { WorkspaceSidebar } from "@/client/components/workspace-sidebar";
import { useWorkspaces } from "@/client/hooks/use-workspaces";
import { useAcp } from "@/client/hooks/use-acp";
import { useSkills } from "@/client/hooks/use-skills";
import { AgentInstallPanel } from "@/client/components/agent-install-panel";
import { SettingsPanel } from "@/client/components/settings-panel";
import { NotificationProvider, NotificationBell } from "@/client/components/notification-center";

export default function HomePage() {
  const router = useRouter();
  const workspacesHook = useWorkspaces();
  const acp = useAcp();
  const skillsHook = useSkills();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAgentInstall, setShowAgentInstall] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Auto-select first workspace on load
  useEffect(() => {
    if (!activeWorkspaceId && workspacesHook.workspaces.length > 0) {
      setActiveWorkspaceId(workspacesHook.workspaces[0].id);
    }
  }, [workspacesHook.workspaces, activeWorkspaceId]);

  // Auto-connect on mount
  useEffect(() => {
    if (!acp.connected && !acp.loading) {
      acp.connect();
    }
  }, [acp.connected, acp.loading]);

  const handleWorkspaceSelect = useCallback((wsId: string) => {
    setActiveWorkspaceId(wsId);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleWorkspaceCreate = useCallback(async (title: string) => {
    const ws = await workspacesHook.createWorkspace(title);
    if (ws) handleWorkspaceSelect(ws.id);
  }, [workspacesHook, handleWorkspaceSelect]);

  return (
    <NotificationProvider>
    <div className="h-screen flex flex-col bg-[#fafafa] dark:bg-[#0a0c12]">
      {/* ─── Minimal Header ─────────────────────────────────────────── */}
      <header className="h-11 shrink-0 flex items-center px-5 z-10 border-b border-gray-100 dark:border-[#151720]">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="Routa" width={22} height={22} className="rounded-md" />
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 tracking-tight">
            Routa
          </span>
        </div>

        <div className="flex-1" />

        <nav className="flex items-center gap-1">
          <button
            onClick={() => setShowAgentInstall(true)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#151720] transition-colors"
          >
            Agents
          </button>
          <NotificationBell />
          <button
            onClick={() => setShowSettingsPanel(true)}
            className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#151720] transition-colors"
            title="Settings"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Single connection status indicator */}
          <div className="ml-2 pl-2 border-l border-gray-200 dark:border-[#1f2233]">
            <ConnectionStatus />
          </div>
        </nav>
      </header>

      {/* ─── Main Content: Left Sidebar + Right Input Area ─────────── */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <WorkspaceSidebar
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceCreate={handleWorkspaceCreate}
        />

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center px-6 py-8">
            {!workspacesHook.loading && workspacesHook.workspaces.length === 0 ? (
              <OnboardingCard onCreateWorkspace={handleWorkspaceCreate} />
            ) : (
              <div className="w-full max-w-2xl flex flex-col items-center">
                <RoutaHeroLogo />
                <HomeInput
                  workspaceId={activeWorkspaceId ?? undefined}
                  onWorkspaceChange={(wsId) => {
                    setActiveWorkspaceId(wsId);
                    setRefreshKey((k) => k + 1);
                  }}
                  onSessionCreated={() => {
                    setRefreshKey((k) => k + 1);
                  }}
                  displaySkills={skillsHook.allSkills}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─── Agent Install Modal ────────────────────────────────────── */}
      {showAgentInstall && (
        <OverlayModal onClose={() => setShowAgentInstall(false)} title="Install Agents">
          <AgentInstallPanel />
        </OverlayModal>
      )}

      {/* ─── Settings Panel ────────────────────────────────────────── */}
      <SettingsPanel
        open={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        providers={acp.providers}
      />
    </div>
    </NotificationProvider>
  );
}

// ─── Routa Hero Logo with Agent Flow Animation ────────────────────────

function RoutaHeroLogo() {
  return (
    <div className="mb-8 flex flex-col items-center gap-4 select-none">
      {/* Animated agent-flow diagram - smaller version */}
      <div className="relative w-[200px] h-[72px]">
        {/* Glow effect behind the diagram */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-amber-500/10 to-emerald-500/10 blur-2xl opacity-50 animate-pulse" />
        
        <svg
          viewBox="0 0 200 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10"
        >
          <defs>
            <linearGradient id="hero-blue" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="hero-orange" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="hero-green" x1="0" y1="0" x2="35" y2="35" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            
            {/* Glow filters */}
            <filter id="glow-blue">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="glow-orange">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="glow-green">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Routes: Routa → Tasks (scaled down) */}
          <path d="M 40 36 C 60 36, 70 16, 90 16" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.2" className="dark:opacity-30" />
          <path d="M 40 36 L 90 36" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.2" className="dark:opacity-30" />
          <path d="M 40 36 C 60 36, 70 56, 90 56" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.2" className="dark:opacity-30" />

          {/* Routes: Tasks → Gate */}
          <path d="M 90 16 C 110 16, 130 36, 160 36" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.2" className="dark:opacity-30" />
          <path d="M 90 36 L 160 36" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.2" className="dark:opacity-30" />
          <path d="M 90 56 C 110 56, 130 36, 160 36" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.2" className="dark:opacity-30" />

          {/* Flowing dots on top route */}
          <circle r="2" fill="#60A5FA" opacity="0.95" filter="url(#glow-blue)">
            <animateMotion dur="2.4s" repeatCount="indefinite" path="M 40 36 C 60 36, 70 16, 90 16" />
            <animate attributeName="opacity" values="0;0.95;0.95;0" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle r="2" fill="#F59E0B" opacity="0.95" filter="url(#glow-orange)">
            <animateMotion dur="2.4s" repeatCount="indefinite" path="M 90 16 C 110 16, 130 36, 160 36" begin="1.2s" />
            <animate attributeName="opacity" values="0;0.95;0.95;0" dur="2.4s" repeatCount="indefinite" begin="1.2s" />
          </circle>

          {/* Flowing dots on middle route */}
          <circle r="2" fill="#60A5FA" opacity="0.95" filter="url(#glow-blue)">
            <animateMotion dur="2s" repeatCount="indefinite" path="M 40 36 L 90 36" />
            <animate attributeName="opacity" values="0;0.95;0.95;0" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle r="2" fill="#F59E0B" opacity="0.95" filter="url(#glow-orange)">
            <animateMotion dur="2s" repeatCount="indefinite" path="M 90 36 L 160 36" begin="1s" />
            <animate attributeName="opacity" values="0;0.95;0.95;0" dur="2s" repeatCount="indefinite" begin="1s" />
          </circle>

          {/* Flowing dots on bottom route */}
          <circle r="2" fill="#60A5FA" opacity="0.95" filter="url(#glow-blue)">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M 40 36 C 60 36, 70 56, 90 56" begin="0.4s" />
            <animate attributeName="opacity" values="0;0.95;0.95;0" dur="2.8s" repeatCount="indefinite" begin="0.4s" />
          </circle>
          <circle r="2" fill="#10B981" opacity="0.95" filter="url(#glow-green)">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M 90 56 C 110 56, 130 36, 160 36" begin="1.8s" />
            <animate attributeName="opacity" values="0;0.95;0.95;0" dur="2.8s" repeatCount="indefinite" begin="1.8s" />
          </circle>

          {/* Routa node (blue) — coordinator */}
          <circle cx="40" cy="36" r="14" fill="url(#hero-blue)" filter="url(#glow-blue)">
            <animate attributeName="r" values="14;15;14" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="40" cy="36" r="7" fill="#0f172a" className="dark:fill-[#0a0c12]" />
          <circle cx="40" cy="36" r="4.5" fill="#60A5FA" opacity="0.4">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite" />
          </circle>

          {/* Task nodes (orange) */}
          <circle cx="90" cy="16" r="7" fill="url(#hero-orange)" filter="url(#glow-orange)" />
          <circle cx="90" cy="16" r="3.5" fill="#0f172a" className="dark:fill-[#0a0c12]" />

          <circle cx="90" cy="36" r="7" fill="url(#hero-orange)" filter="url(#glow-orange)" />
          <circle cx="90" cy="36" r="3.5" fill="#0f172a" className="dark:fill-[#0a0c12]" />

          <circle cx="90" cy="56" r="7" fill="url(#hero-orange)" filter="url(#glow-orange)" />
          <circle cx="90" cy="56" r="3.5" fill="#0f172a" className="dark:fill-[#0a0c12]" />

          {/* Gate node (green) — verification */}
          <circle cx="160" cy="36" r="11" fill="url(#hero-green)" filter="url(#glow-green)">
            <animate attributeName="r" values="11;12;11" dur="3s" repeatCount="indefinite" begin="1.5s" />
          </circle>
          <circle cx="160" cy="36" r="5.5" fill="#0f172a" className="dark:fill-[#0a0c12]" />
          <circle cx="160" cy="36" r="3.5" fill="#10B981" opacity="0.45">
            <animate attributeName="opacity" values="0.25;0.65;0.25" dur="3s" repeatCount="indefinite" begin="1.5s" />
          </circle>
        </svg>
      </div>

      {/* Minimal brand text */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-white dark:to-gray-100 bg-clip-text text-transparent">
          Routa
        </h1>
      </div>
    </div>
  );
}

// ─── Connection Status ────────────────────────────────────────────────

function ConnectionStatus() {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // TODO: Get actual connection status from hooks
  const mcpConnected = true;
  const acpConnected = true;
  
  const allConnected = mcpConnected && acpConnected;
  const partialConnected = mcpConnected || acpConnected;
  
  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-1.5 cursor-default">
        <span className={`w-1.5 h-1.5 rounded-full ring-2 ${
          allConnected 
            ? "bg-emerald-500 ring-emerald-500/20" 
            : partialConnected 
            ? "bg-amber-500 ring-amber-500/20" 
            : "bg-red-500 ring-red-500/20"
        }`} />
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {allConnected ? "Connected" : partialConnected ? "Partial" : "Offline"}
        </span>
      </div>
      
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-800 text-white shadow-xl z-50 min-w-[100px]">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-gray-300">MCP</span>
            <span>{mcpConnected ? "✓" : "✗"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px] mt-1">
            <span className="text-gray-300">ACP</span>
            <span>{acpConnected ? "✓" : "✗"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Onboarding Card ──────────────────────────────────────────────────

function OnboardingCard({ onCreateWorkspace }: { onCreateWorkspace: (title: string) => void }) {
  return (
    <div className="w-full max-w-sm text-center">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/20">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
        Create a workspace
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Organize your sessions and projects in one place.
      </p>
      <button
        type="button"
        onClick={() => onCreateWorkspace("My Workspace")}
        className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
      >
        Get Started
      </button>
    </div>
  );
}

// ─── Recent Sessions ──────────────────────────────────────────────────

// ─── Overlay Modal ────────────────────────────────────────────────────

function OverlayModal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-5xl h-[80vh] bg-white dark:bg-[#12141c] border border-gray-200 dark:border-[#1c1f2e] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-11 px-4 border-b border-gray-100 dark:border-[#1c1f2e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </span>
            <a
              href="/settings/agents"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Open in new tab
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-[#1c1f2e] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Close (Esc)"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-[calc(80vh-44px)]">{children}</div>
      </div>
    </div>
  );
}