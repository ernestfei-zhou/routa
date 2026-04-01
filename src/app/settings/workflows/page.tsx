"use client";

import { SettingsRouteShell } from "@/client/components/settings-route-shell";
import { SettingsPageHeader } from "@/client/components/settings-page-header";
import { WorkflowPanel } from "@/client/components/workflow-panel";
import { Workflow } from "lucide-react";


export default function WorkflowSettingsPage() {
  return (
    <SettingsRouteShell
      title="Workflows"
      description="Compose and run recurring workflows that coordinate multiple actions, triggers, and agents."
      badgeLabel="Automation"
      icon={(
        <Workflow className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}/>
      )}
      summary={[
        { label: "Focus", value: "Reusable automation flows" },
        { label: "Output", value: "Tasks and graph execution" },
      ]}
    >
      <div className="space-y-6">
        <SettingsPageHeader
          title="Workflows"
          description="Compose and run recurring workflows that coordinate multiple actions, triggers, and agents."
          metadata={[
            { label: "Focus", value: "Reusable automation flows" },
            { label: "Output", value: "Tasks and graph execution" },
          ]}
        />

        <WorkflowPanel />
      </div>
    </SettingsRouteShell>
  );
}
