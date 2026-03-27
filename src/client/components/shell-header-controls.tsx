"use client";

import React from "react";

import { ProtocolBadge } from "@/app/protocol-badge";

import { DockerStatusIndicator } from "./docker-status-indicator";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";

interface ShellHeaderControlsProps {
  className?: string;
  showProtocolBadges?: boolean;
}

export function ShellHeaderControls({
  className = "",
  showProtocolBadges = true,
}: ShellHeaderControlsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="hidden lg:flex">
        <DockerStatusIndicator />
      </div>
      {showProtocolBadges ? (
        <div className="hidden lg:flex items-center gap-2">
          <ProtocolBadge name="MCP" endpoint="/api/mcp" />
          <ProtocolBadge name="ACP" endpoint="/api/acp" />
        </div>
      ) : null}
      <LanguageSwitcher />
      <ThemeSwitcher compact />
    </div>
  );
}
