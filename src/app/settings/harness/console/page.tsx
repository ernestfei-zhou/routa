"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Shared tiny components                                            */
/* ------------------------------------------------------------------ */

function Pill({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "yellow" | "orange" | "red" | "gray" }) {
  const map: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    orange: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    gray: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${map[color]}`}>
      {children}
    </span>
  );
}

function KpiCard({ label, value, sub, accent = "blue" }: { label: string; value: string; sub: string; accent?: "blue" | "green" | "yellow" | "orange" | "red" }) {
  const ring: Record<string, string> = {
    blue: "border-blue-500/40",
    green: "border-emerald-500/40",
    yellow: "border-yellow-500/40",
    orange: "border-amber-500/40",
    red: "border-red-500/40",
  };
  const textColor: Record<string, string> = {
    blue: "text-blue-400",
    green: "text-emerald-400",
    yellow: "text-yellow-400",
    orange: "text-amber-400",
    red: "text-red-400",
  };
  return (
    <div className={`flex flex-col gap-0.5 rounded border ${ring[accent]} bg-[#1e2030] px-3 py-2`}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`text-lg font-bold leading-tight ${textColor[accent]}`}>{value}</span>
      <span className="text-[10px] text-slate-500">{sub}</span>
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-700/60 bg-[#1e2030]/80">
      <div className="border-b border-slate-700/40 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <div className="px-2.5 py-2 text-[11px] leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

function ModuleCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col rounded border border-slate-700/60 bg-[#1e2030] ${className}`}>
      <div className="border-b border-slate-700/40 px-3 py-1.5">
        <span className="text-[11px] font-semibold text-slate-300">{title}</span>
      </div>
      <div className="flex-1 px-3 py-2 text-[11px] leading-relaxed text-slate-400">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                    */
/* ------------------------------------------------------------------ */

function Check({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className={done ? "text-emerald-400" : "text-slate-600"}>
        {done ? "✓" : "□"}
      </span>
      <span className={done ? "text-slate-300" : "text-slate-500"}>{label}</span>
    </div>
  );
}

function StatusDot({ status }: { status: "pass" | "warn" | "pending" | "fail" }) {
  const cls: Record<string, string> = {
    pass: "bg-emerald-400",
    warn: "bg-yellow-400",
    pending: "bg-slate-500",
    fail: "bg-red-400",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${cls[status]}`} />;
}

/* ------------------------------------------------------------------ */
/*  Evidence table row type                                          */
/* ------------------------------------------------------------------ */

interface EvidenceRow {
  stage: string;
  status: "pass" | "warn" | "pending" | "fail";
  command: string;
  evidence: string;
  gate: string;
  next: string;
}

const evidenceRows: EvidenceRow[] = [
  { stage: "lint", status: "pass", command: "pnpm lint --filter auth", evidence: "0 errors / 0 warnings", gate: "hard", next: "continue tests" },
  { stage: "unit-test", status: "pass", command: "make test-auth", evidence: "12 / 12 pass · 86s", gate: "hard", next: "run api parity" },
  { stage: "api-parity", status: "warn", command: "make api-parity", evidence: "1 schema alias mismatch", gate: "warn", next: "inspect spec diff" },
  { stage: "security", status: "pass", command: "semgrep auth profile", evidence: "0 findings", gate: "info", next: "ready for review" },
  { stage: "review-note", status: "pending", command: "request sign-off", evidence: "waiting payments-platform", gate: "human", next: "block merge until approved" },
];

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */

export default function HarnessConsolePage() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [evidenceTab, setEvidenceTab] = useState("Evidence");

  const editorTabs = ["Overview", "Contract", "Diff", "Evidence", "Review"];
  const panelTabs = ["Evidence", "Problems", "JSON", "Comments", "Trace"];
  const activityIcons = [
    { key: "W", active: true },
    { key: "T", active: false },
    { key: "G", active: false },
    { key: "C", active: false },
    { key: "R", active: false },
    { key: "J", active: false },
    { key: "P", active: false },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#e8eaed] px-4 py-5 dark:bg-[#0f1117]">
      {/* Page title - outside IDE window */}
      <div className="mb-3 w-full max-w-360 px-1">
        <h1 className="text-[14px] font-semibold text-slate-700 dark:text-slate-300">
          Harness Console · VS Code 内嵌一页式工作台（详细稿）
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">
          Repo Contract · Guardrails · Evidence · Review/Fix Loop · Approval UX · Work Item Surface
        </p>
      </div>

      {/* ============================================================ */}
      {/*  IDE Window                                                   */}
      {/* ============================================================ */}
      <div className="w-full max-w-360 overflow-hidden rounded-lg border border-slate-600/50 bg-[#191b28] shadow-2xl">

        {/* ── Window Title Bar ─────────────────────────────────── */}
        <div className="flex h-9 items-center justify-between border-b border-slate-700/60 bg-[#14161f] px-3">
          <div className="flex items-center gap-2.5">
            {/* macOS dots */}
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[12px] font-semibold tracking-wide text-slate-400">Harness Console</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span>workspace: <span className="text-slate-400">payments-monorepo</span></span>
            <span>branch: <span className="text-blue-400">feature/PAY-1842-auth-guard</span></span>
            <span>mode: <span className="text-emerald-400">guarded</span></span>
          </div>
        </div>

        {/* ── Main body: Activity Bar | Side Bar | Editor | Right Col */}
        <div className="flex" style={{ height: "calc(100vh - 180px)", minHeight: 700 }}>

          {/* ── Activity Bar ──────────────────────────────────── */}
          <div className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-slate-700/50 bg-[#14161f] py-2">
            {activityIcons.map(({ key, active }) => (
              <button
                key={key}
                type="button"
                className={`flex h-9 w-9 items-center justify-center rounded text-[12px] font-bold transition-colors ${
                  active
                    ? "bg-blue-600/20 text-blue-400 shadow-[inset_2px_0_0_0_#3b82f6]"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          {/* ── Primary Side Bar ──────────────────────────────── */}
          <div className="flex w-62.5 shrink-0 flex-col border-r border-slate-700/50 bg-[#181a26] desktop-scrollbar-thin overflow-y-auto">
            <div className="border-b border-slate-700/40 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Harness</div>
              <div className="mt-0.5 text-[10px] text-slate-600">工作台 / 当前仓库</div>
            </div>

            {/* Search */}
            <div className="px-2.5 py-2">
              <div className="flex items-center rounded border border-slate-700/50 bg-[#141520] px-2 py-1.5">
                <span className="mr-1.5 text-[10px] text-slate-600">⌕</span>
                <span className="text-[10px] text-slate-600">搜索任务、规则、证据、术语…</span>
              </div>
            </div>

            {/* Side bar cards */}
            <div className="flex flex-col gap-2 px-2.5 pb-3">
              {/* Card 1: 视图 */}
              <SideCard title="01 视图">
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between"><span>工作台</span><span className="text-blue-400">03</span></div>
                  <div className="flex justify-between"><span>任务队列</span><span className="text-blue-400">09</span></div>
                  <div className="flex justify-between"><span>Gate &amp; 风险</span><span className="text-yellow-400">02</span></div>
                  <div className="flex justify-between"><span>Repo Contract</span><span className="text-slate-400">12</span></div>
                  <div className="flex justify-between"><span>Review / Fix</span><span className="text-orange-400">05</span></div>
                  <div className="flex justify-between"><span>Background Jobs</span><span className="text-slate-400">04</span></div>
                </div>
              </SideCard>

              {/* Card 2: Work Item */}
              <SideCard title="02 Work Item">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-200">PAY-1842 修复授权 API</div>
                  <div className="text-[10px] text-slate-500">来源：Jira / PR template</div>
                  <div className="text-[10px]">目标：补齐 token refresh 路径上的 authorization guard</div>
                  <div className="text-[10px] text-yellow-400/80">约束：禁止修改 api/public/*；只允许 auth 范围最小 diff</div>
                </div>
              </SideCard>

              {/* Card 3: 智能体角色 */}
              <SideCard title="智能体角色">
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between"><span>Planner</span><span className="text-emerald-400">已完成</span></div>
                  <div className="flex justify-between"><span>Implementer</span><span className="text-blue-400">运行中 / 本地 diff</span></div>
                  <div className="flex justify-between"><span>Verifier</span><span className="text-yellow-400">等待 api-parity</span></div>
                  <div className="flex justify-between"><span>Reviewer</span><span className="text-slate-500">待人工 sign-off</span></div>
                </div>
              </SideCard>

              {/* Card 4: Context Pack */}
              <SideCard title="Context Pack">
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between"><span>repo_contract.json</span><span className="text-slate-400">v0.8</span></div>
                  <div className="flex justify-between"><span>glossary terms</span><span className="text-slate-400">18</span></div>
                  <div className="flex justify-between"><span>active rules</span><span className="text-slate-400">12</span></div>
                  <div className="flex justify-between"><span>past PR context</span><span className="text-slate-400">2</span></div>
                  <div className="flex justify-between"><span>loaded docs</span><span className="text-slate-400">7</span></div>
                </div>
              </SideCard>

              {/* Card 5: Loop 提示 */}
              <SideCard title="Loop 提示">
                <div className="space-y-1 text-[10px]">
                  <div className="text-blue-400">Observe → Think → Act → Feedback</div>
                  <div>不是给 Agent 看日志，而是给结构化结果。</div>
                  <div className="text-emerald-400/80">在 guardrail mode 下运行。</div>
                </div>
              </SideCard>
            </div>
          </div>

          {/* ── Center + Right Column ─────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col">

            {/* ── Editor Tabs + Actions ───────────────────────── */}
            <div className="flex h-9 items-center justify-between border-b border-slate-700/50 bg-[#14161f] px-1">
              <div className="flex items-center">
                {editorTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-[11px] font-medium transition-colors ${
                      activeTab === tab
                        ? "border-b-2 border-blue-500 bg-[#191b28] text-slate-200"
                        : "text-slate-500 hover:text-slate-400"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pr-2">
                <button type="button" className="rounded border border-slate-600 bg-transparent px-2.5 py-1 text-[10px] text-slate-400 hover:bg-slate-700/40">人工接管</button>
                <button type="button" className="rounded border border-slate-600 bg-transparent px-2.5 py-1 text-[10px] text-slate-400 hover:bg-slate-700/40">补证据</button>
                <button type="button" className="rounded border border-blue-500/50 bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-blue-500">生成 PR</button>
              </div>
            </div>

            {/* ── Scrollable editor area ──────────────────────── */}
            <div className="flex min-h-0 flex-1 overflow-y-auto desktop-scrollbar" style={{ scrollbarGutter: "stable" }}>
              <div className="flex-1 min-w-0 p-3 space-y-3">

                {/* ── Workbench Hero ──────────────────────────── */}
                <div>
                  <h2 className="text-[15px] font-bold text-slate-200">
                    Workbench · PAY-1842 修复授权 API
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    目标：在不碰触 public API 的前提下，为 token 续签补齐授权检查，并生成可验证证据。
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill color="blue">scope: api/auth/*</Pill>
                    <Pill color="orange">risk: medium</Pill>
                    <Pill color="gray">owner: payments-platform</Pill>
                    <Pill color="green">mode: assist+verify</Pill>
                    <Pill color="yellow">policy: guarded</Pill>
                  </div>
                </div>

                {/* ── KPI Cards ───────────────────────────────── */}
                <div className="grid grid-cols-5 gap-2">
                  <KpiCard label="Time to first feedback" value="2m36s" sub="首个结构化结果已返回" accent="blue" />
                  <KpiCard label="Autonomous progress" value="74%" sub="仍需 1 次人工确认" accent="green" />
                  <KpiCard label="Hard gates" value="3 / 4" sub="api-parity 仍未通过" accent="yellow" />
                  <KpiCard label="Blast radius" value="12 files" sub="已限制在 auth 边界" accent="orange" />
                  <KpiCard label="Review state" value="2 notes" sub="1 条需要平台 owner" accent="red" />
                </div>

                {/* ── Core Modules Grid ───────────────────────── */}
                <div className="grid grid-cols-3 gap-2">

                  {/* Module A: Objective / Done Definition */}
                  <ModuleCard title="Objective / Done Definition" className="row-span-1">
                    <div className="space-y-1.5">
                      <div className="text-slate-300">JTBD：修复 refresh token 流程中的授权缺口。</div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Done when</div>
                      <ol className="ml-3 list-decimal space-y-0.5 text-[10px]">
                        <li>refresh path 复用现有 authorization rule</li>
                        <li>api parity 不变</li>
                        <li>auth unit + contract tests 均通过</li>
                        <li>PR 描述里附上 evidence summary 与 risk note</li>
                      </ol>
                    </div>
                  </ModuleCard>

                  {/* Module B: Repo Contract Snapshot */}
                  <ModuleCard title="Repo Contract Snapshot">
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Glossary</div>
                        <div className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                          <span>授权 = authorization</span>
                          <span>续签 = refresh / renew</span>
                          <span>鉴权 = authz</span>
                          <span>额度 = limit / quota</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Allowed commands</div>
                        <div className="mt-0.5 space-y-0.5 font-mono text-[10px] text-blue-400/80">
                          <div>make test-auth</div>
                          <div>make api-parity</div>
                          <div>pnpm lint --filter auth</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Architecture hints</div>
                        <div className="mt-0.5 text-[10px]">
                          auth service → policy adapter → token store<br />
                          <span className="text-red-400/80">禁止</span> auth → payments-db direct access
                        </div>
                      </div>
                    </div>
                  </ModuleCard>

                  {/* Module C: Approval & Guardrails */}
                  <ModuleCard title="Approval & Guardrails">
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">需要人工确认</div>
                        <ul className="mt-0.5 ml-2.5 list-disc text-[10px] text-yellow-400/80">
                          <li>auth 边界被碰触</li>
                          <li>review owner = payments-platform</li>
                        </ul>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Blast Radius</div>
                        <div className="mt-0.5 space-y-0.5 text-[10px]">
                          <div><span className="text-emerald-400">允许：</span>services/auth/*、tests/auth/*</div>
                          <div><span className="text-red-400">禁止：</span>ui/public/*、payments/core/*</div>
                          <div><span className="text-red-400">network:</span> off</div>
                          <div><span className="text-red-400">destructive git:</span> denied</div>
                        </div>
                      </div>
                    </div>
                  </ModuleCard>
                </div>

                {/* ── Second row of modules ───────────────────── */}
                <div className="grid grid-cols-3 gap-2">

                  {/* Module D: Agent Plan / Trace */}
                  <ModuleCard title="Agent Plan / Trace" className="col-span-1">
                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <Check done label="读取 repo contract、arch hints、glossary" />
                        <Check done label="回放 2 个失败 PR 评论，收敛命名与 review owner" />
                        <Check done={false} label="生成最小 diff：authorization_guard.ts / refresh_token.ts" />
                        <Check done={false} label="运行 lint、auth unit tests、等待 api-parity" />
                        <Check done={false} label="生成 reviewer summary，请求 payments-platform sign-off" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Changed files</div>
                        <div className="mt-0.5 space-y-0.5 font-mono text-[10px] text-blue-400/70">
                          <div>services/auth/refresh_token.ts</div>
                          <div>services/auth/authorization_guard.ts</div>
                          <div>tests/auth/refresh_token.spec.ts</div>
                          <div>docs/fitness/unit-test.md (evidence only)</div>
                        </div>
                      </div>
                    </div>
                  </ModuleCard>

                  {/* Module E: Evidence Graph / Impact */}
                  <ModuleCard title="Evidence Graph / Impact">
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Graph</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                          {["work item", "diff", "lint", "unit-test", "api-parity", "review", "PR"].map((node, i, arr) => (
                            <span key={node} className="flex items-center gap-1">
                              <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-slate-300">{node}</span>
                              {i < arr.length - 1 && <span className="text-slate-600">→</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Impact</div>
                        <div className="mt-0.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                          <span>changed modules <span className="text-blue-400">03</span></span>
                          <span>high-impact paths <span className="text-yellow-400">01</span></span>
                          <span>affected tests <span className="text-blue-400">08</span></span>
                          <span>past review context <span className="text-slate-400">02</span></span>
                          <span>suspicious pattern <span className="text-emerald-400">none</span></span>
                        </div>
                      </div>
                    </div>
                  </ModuleCard>

                  {/* Module F + G stacked */}
                  <div className="flex flex-col gap-2">
                    {/* Module F: Required Evidence */}
                    <ModuleCard title="Required Evidence">
                      <div className="space-y-0.5">
                        <Check done label="lint" />
                        <Check done label="auth unit tests" />
                        <Check done={false} label="api-parity" />
                        <Check done={false} label="reviewer sign-off" />
                        <Check done label="command transcript" />
                        <Check done label="risk summary" />
                      </div>
                    </ModuleCard>

                    {/* Module G: Next Best Action */}
                    <ModuleCard title="Next Best Action">
                      <ol className="ml-3 list-decimal space-y-0.5 text-[10px]">
                        <li className="text-blue-400">运行 make api-parity</li>
                        <li>附上 unit-test.md</li>
                        <li>请求 platform reviewer</li>
                      </ol>
                    </ModuleCard>
                  </div>
                </div>
              </div>

              {/* ── Right Approval / Action Column ────────────── */}
              <div className="hidden w-50 shrink-0 flex-col gap-2 border-l border-slate-700/50 bg-[#16182280] p-2 xl:flex desktop-scrollbar-thin overflow-y-auto">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Approval Queue</div>

                <div className="rounded border border-yellow-500/30 bg-yellow-500/5 px-2 py-1.5 text-[10px]">
                  <div className="font-semibold text-yellow-400">待确认</div>
                  <div className="mt-0.5 text-slate-400">auth 边界碰触，需人工确认</div>
                  <div className="mt-1 flex gap-1">
                    <button type="button" className="rounded bg-emerald-600/30 px-2 py-0.5 text-[9px] text-emerald-300 hover:bg-emerald-600/50">批准</button>
                    <button type="button" className="rounded bg-red-600/30 px-2 py-0.5 text-[9px] text-red-300 hover:bg-red-600/50">拒绝</button>
                  </div>
                </div>

                <div className="rounded border border-slate-700/50 bg-[#1e2030]/60 px-2 py-1.5 text-[10px]">
                  <div className="font-semibold text-slate-400">Policy: guarded</div>
                  <div className="mt-0.5 text-slate-500">禁止自动 merge，必须人工 sign-off</div>
                </div>

                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">Risk Summary</div>
                <div className="rounded border border-slate-700/50 bg-[#1e2030]/60 px-2 py-1.5 text-[10px]">
                  <div className="space-y-0.5 text-slate-400">
                    <div className="flex justify-between">
                      <span>blast radius</span>
                      <span className="text-orange-400">medium</span>
                    </div>
                    <div className="flex justify-between">
                      <span>api-parity</span>
                      <span className="text-yellow-400">warn</span>
                    </div>
                    <div className="flex justify-between">
                      <span>security</span>
                      <span className="text-emerald-400">pass</span>
                    </div>
                    <div className="flex justify-between">
                      <span>test coverage</span>
                      <span className="text-emerald-400">pass</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">Sign-off Log</div>
                <div className="rounded border border-slate-700/50 bg-[#1e2030]/60 px-2 py-1.5 text-[10px] text-slate-500">
                  <div className="space-y-1">
                    <div><span className="text-emerald-400">✓</span> auto: lint pass</div>
                    <div><span className="text-emerald-400">✓</span> auto: unit-test pass</div>
                    <div><span className="text-yellow-400">⚠</span> auto: api-parity warn</div>
                    <div><span className="text-slate-500">○</span> human: review pending</div>
                  </div>
                </div>

                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">Quick Actions</div>
                <div className="space-y-1">
                  <button type="button" className="w-full rounded border border-slate-600 bg-transparent px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700/40">查看 Diff</button>
                  <button type="button" className="w-full rounded border border-slate-600 bg-transparent px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700/40">回溯 Trace</button>
                  <button type="button" className="w-full rounded border border-blue-500/40 bg-blue-600/20 px-2 py-1 text-[10px] text-blue-300 hover:bg-blue-600/30">Run api-parity</button>
                </div>
              </div>
            </div>

            {/* ── Bottom Panel: Structured Evidence Panel ─────── */}
            <div className="flex h-55 shrink-0 flex-col border-t border-slate-700/50 bg-[#14161f]">

              {/* Panel header */}
              <div className="flex h-8 items-center justify-between border-b border-slate-700/40 px-3">
                <div className="flex items-center gap-0.5">
                  {panelTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setEvidenceTab(tab)}
                      className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                        evidenceTab === tab
                          ? "border-b border-blue-500 text-slate-200"
                          : "text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-600">Structured Evidence Panel</span>
              </div>

              {/* Panel body */}
              <div className="flex min-h-0 flex-1 overflow-hidden">
                {/* Table */}
                <div className="flex-1 overflow-auto desktop-scrollbar-thin">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-700/40 text-[9px] uppercase tracking-wider text-slate-600">
                        <th className="px-3 py-1.5 font-semibold">Stage</th>
                        <th className="px-2 py-1.5 font-semibold">Status</th>
                        <th className="px-2 py-1.5 font-semibold">Command</th>
                        <th className="px-2 py-1.5 font-semibold">Evidence</th>
                        <th className="px-2 py-1.5 font-semibold">Gate</th>
                        <th className="px-2 py-1.5 font-semibold">Next</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidenceRows.map((row) => (
                        <tr key={row.stage} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-3 py-1.5 font-medium text-slate-300">{row.stage}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <StatusDot status={row.status} />
                              <span className="text-slate-400">{row.status}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 font-mono text-blue-400/70">{row.command}</td>
                          <td className="px-2 py-1.5 text-slate-400">{row.evidence}</td>
                          <td className="px-2 py-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                              row.gate === "hard" ? "bg-red-500/15 text-red-400" :
                              row.gate === "warn" ? "bg-yellow-500/15 text-yellow-400" :
                              row.gate === "human" ? "bg-blue-500/15 text-blue-400" :
                              "bg-slate-500/15 text-slate-400"
                            }`}>
                              {row.gate}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-slate-500">{row.next}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Machine-readable output */}
                <div className="w-[320px] shrink-0 border-l border-slate-700/40 overflow-auto desktop-scrollbar-thin">
                  <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-slate-600 border-b border-slate-700/40">
                    machine-readable output
                  </div>
                  <pre className="px-3 py-2 text-[10px] leading-relaxed text-emerald-400/80 font-mono">
{`{
  "work_item": "PAY-1842",
  "stage": "api-parity",
  "status": "warn",
  "blast_radius": {
    "files": 12,
    "scope": "api/auth/*"
  },
  "next_action": "inspect spec diff",
  "requires_human": true
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* ── Status Bar ──────────────────────────────────── */}
            <div className="flex h-6 items-center justify-between border-t border-slate-700/50 bg-[#007acc] px-3 text-[10px] text-white/90">
              <div className="flex items-center gap-3">
                <span>payments-monorepo</span>
                <span>·</span>
                <span>guarded mode</span>
                <span>·</span>
                <span>review/fix loop</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-yellow-200">3 warnings</span>
                <span>·</span>
                <span className="text-yellow-200">1 human approval required</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
