/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";
import { ensureMcpForProvider, parseMcpServersFromConfigs } from "../mcp-setup";

vi.mock("@/core/store/custom-mcp-server-store", () => ({
  getCustomMcpServerStore: () => null,
  mergeCustomMcpServers: (builtIn: Record<string, unknown>) => builtIn,
}));

describe("ensureMcpForProvider", () => {
  it("writes Claude MCP config to a temp file so SDK parsing still works", async () => {
    const result = await ensureMcpForProvider("claude", {
      routaServerUrl: "http://127.0.0.1:3000",
      workspaceId: "ws-test",
      includeCustomServers: false,
    });

    expect(result.mcpConfigs).toHaveLength(1);
    // After fix: config is a file path (contains "mcp-tmp"), not inline JSON
    expect(result.mcpConfigs[0]).toContain("mcp-tmp");

    const parsed = parseMcpServersFromConfigs(result.mcpConfigs);
    expect(parsed?.["routa-coordination"]).toMatchObject({
      type: "http",
      url: "http://127.0.0.1:3000/api/mcp",
    });
  });
});
