"use client";

import { DockerStatusIndicator } from "./docker-status-indicator";
import { SettingsPopupMenu } from "./settings-popup-menu";
import { McpStatusIndicator } from "./mcp-status-indicator";


interface ShellHeaderControlsProps {
  className?: string;
  showPreferencesMenu?: boolean;
  compactStatus?: boolean;
}

export function ShellHeaderControls({
  className = "",
  showPreferencesMenu = false,
  compactStatus = false,
}: ShellHeaderControlsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="hidden lg:flex">
        <DockerStatusIndicator compact={compactStatus} />
      </div>
      <div className="hidden lg:flex">
        <McpStatusIndicator compact={compactStatus} />
      </div>
      {showPreferencesMenu ? (
        <SettingsPopupMenu
          position="topbar"
          showSettingsLink={false}
          showLabel={false}
          buttonClassName="h-8 w-8 justify-center px-0"
        />
      ) : null}
    </div>
  );
}
