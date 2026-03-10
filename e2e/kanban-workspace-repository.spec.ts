import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const PRIMARY_REPO_PATH = "/Users/phodal/ai/routa-js";

test.use({
  baseURL: BASE_URL,
  video: "on",
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
});

test.describe("Kanban workspace repository association", () => {
  test.setTimeout(180_000);

  test("covers workspace repos, issue repo links, worktree lifecycle, and workspace root isolation", async ({
    page,
    request,
  }) => {
    const testId = Date.now().toString();
    const title = `Kanban Repo Flow ${testId}`;
    const worktreeRoot = `/tmp/routa-kanban-${testId}`;

    const workspaceResponse = await request.post("/api/workspaces", {
      data: { title: `Kanban Repo Workspace ${testId}` },
    });
    expect(workspaceResponse.ok()).toBeTruthy();
    const workspaceData = await workspaceResponse.json();
    const workspaceId = workspaceData.workspace.id as string;

    const patchWorkspaceResponse = await request.patch(`/api/workspaces/${workspaceId}`, {
      data: { metadata: { worktreeRoot } },
    });
    expect(patchWorkspaceResponse.ok()).toBeTruthy();

    const primaryCodebaseResponse = await request.post(`/api/workspaces/${workspaceId}/codebases`, {
      data: {
        repoPath: PRIMARY_REPO_PATH,
        branch: "main",
        label: "routa-main",
      },
    });
    expect(primaryCodebaseResponse.ok()).toBeTruthy();
    const primaryCodebase = (await primaryCodebaseResponse.json()).codebase as { id: string };

    const secondaryCodebaseResponse = await request.post(`/api/workspaces/${workspaceId}/codebases`, {
      data: {
        repoPath: `/tmp/routa-secondary-${testId}`,
        branch: "main",
        label: "secondary-context",
      },
    });
    expect(secondaryCodebaseResponse.ok()).toBeTruthy();
    const secondaryCodebase = (await secondaryCodebaseResponse.json()).codebase as { id: string };

    const boardResponse = await request.get(`/api/kanban/boards?workspaceId=${workspaceId}`);
    expect(boardResponse.ok()).toBeTruthy();

    await page.goto(`/workspace/${workspaceId}`);
    await page.waitForLoadState("domcontentloaded");

    const worktreeRootInput = page.getByTestId("worktree-root-input");
    await expect(worktreeRootInput).toBeVisible();
    await expect(worktreeRootInput).toHaveValue(worktreeRoot);
    await page.screenshot({ path: "test-results/kanban-workspace-root-settings.png", fullPage: true });

    await page.getByRole("button", { name: "Kanban" }).click();
    await page.waitForTimeout(1000);

    const codebaseBadges = page.getByTestId("codebase-badge");
    await expect(codebaseBadges).toHaveCount(2);
    await expect(codebaseBadges.first()).toContainText("routa-main");

    await codebaseBadges.first().click();
    const codebaseModal = page.getByTestId("codebase-detail-modal");
    await expect(codebaseModal).toBeVisible();
    await expect(codebaseModal).toContainText(PRIMARY_REPO_PATH);
    await page.screenshot({ path: "test-results/kanban-codebase-detail.png" });
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByTestId("repo-selector")).toBeVisible();
    await page.getByPlaceholder("Issue title").fill(title);
    await page.getByPlaceholder("Describe the work").fill(
      "Validate kanban repository association workflow"
    );
    await page.screenshot({ path: "test-results/kanban-create-issue-modal.png" });
    await page.getByRole("button", { name: "Create", exact: true }).click();

    const card = page.getByTestId("kanban-card").filter({ hasText: title }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByTestId("repo-badge").first()).toContainText("routa-main");
    await page.screenshot({ path: "test-results/kanban-card-with-repo-badge.png" });

    await card.getByRole("button", { name: "View detail" }).click();
    await expect(page.getByTestId("detail-repo-toggle")).toHaveCount(2);
    await page.getByTestId("detail-repo-toggle").filter({ hasText: "secondary-context" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/kanban-detail-repo-edit.png" });
    await page.getByRole("button", { name: "Close" }).last().click();

    const devColumn = page.getByTestId("kanban-column").filter({ hasText: "Dev" }).first();
    await card.dragTo(devColumn);
    await page.waitForTimeout(3_000);

    const movedCard = page.getByTestId("kanban-card").filter({ hasText: title }).first();
    const worktreeBadge = movedCard.getByTestId("worktree-badge");
    await expect(worktreeBadge).toBeVisible({ timeout: 20_000 });
    await worktreeBadge.click();

    const worktreeDetail = page.getByTestId("worktree-detail");
    await expect(worktreeDetail).toBeVisible();
    await expect(worktreeDetail).toContainText(worktreeRoot);
    await expect(worktreeDetail).toContainText("routa-main");
    await page.screenshot({ path: "test-results/kanban-worktree-detail.png" });

    page.once("dialog", (dialog) => dialog.accept());
    const doneColumn = page.getByTestId("kanban-column").filter({ hasText: "Done" }).first();
    await movedCard.dragTo(doneColumn);
    await page.waitForTimeout(2_000);

    const doneCard = page.getByTestId("kanban-card").filter({ hasText: title }).first();
    await doneCard.getByRole("button", { name: "View detail" }).click();
    await expect(page.getByTestId("worktree-detail")).toHaveCount(0);
    await page.screenshot({ path: "test-results/kanban-done-cleanup.png" });

    const taskResponse = await request.get(`/api/tasks?workspaceId=${workspaceId}`);
    expect(taskResponse.ok()).toBeTruthy();
    const tasksData = await taskResponse.json();
    const createdTask = (tasksData.tasks as Array<{ title: string; codebaseIds?: string[]; worktreeId?: string }>).find(
      (task) => task.title === title
    );

    expect(createdTask).toBeTruthy();
    expect(createdTask?.codebaseIds).toContain(primaryCodebase.id);
    expect(createdTask?.codebaseIds).toContain(secondaryCodebase.id);
    expect(createdTask?.worktreeId).toBeFalsy();
  });
});