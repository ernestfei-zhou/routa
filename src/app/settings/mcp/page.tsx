"use client";

import { SettingsRouteShell } from "@/client/components/settings-route-shell";
import { SettingsPageHeader } from "@/client/components/settings-page-header";
import { McpServersTab } from "@/client/components/settings-panel-mcp-tab";
import { Server } from "lucide-react";


export default function McpSettingsPage() {
  return (
    <SettingsRouteShell
      title="MCP Servers"
      description="Manage Model Context Protocol servers, transports, and local integration points for your workspace."
      badgeLabel="Integration"
      icon={(
        <Server className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}/>
      )}
      summary={[
        { label: "Transport", value: "stdio / http / sse" },
        { label: "Scope", value: "Workspace integrations" },
      ]}
    >
      <div className="space-y-4">
        <SettingsPageHeader
          title="MCP Servers"
          description="Manage Model Context Protocol servers, transports, and local integration points for your workspace."
          metadata={[
            { label: "Transport", value: "stdio / http / sse" },
            { label: "Scope", value: "Workspace integrations" },
          ]}
        />
        <div className="rounded-2xl border border-desktop-border bg-desktop-bg-secondary/70 shadow-sm">
          <McpServersTab />
        </div>
      </div>
    </SettingsRouteShell>
  );
}
