import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../shell-header-controls", () => ({
  ShellHeaderControls: ({ showSettingsMenu }: { showSettingsMenu?: boolean }) => (
    <div data-testid="shell-header-controls" data-show-settings-menu={showSettingsMenu ? "true" : "false"} />
  ),
}));

import { DesktopShellHeader } from "../desktop-shell-header";

describe("DesktopShellHeader", () => {
  it("shows global settings controls in the shell header", () => {
    render(<DesktopShellHeader workspaceId="default" workspaceTitle="Default Workspace" />);

    expect(screen.getByTestId("shell-header-controls").getAttribute("data-show-settings-menu")).toBe("true");
  });
});
