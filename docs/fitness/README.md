# Rust Fitness Function

## Scope
- Scope: Rust 单元测试 + API use-case 测试，覆盖 `routa-core` 与 `routa-server`（含关键链路 `routa-cli` / `routa-rpc`）。
- 目标不是“覆盖率数字”，而是“变更后核心行为在有无回归下仍可被验证”。
- 评估依据必须来自可执行证据（测试文件、失败原因、命令输出片段）。

## Flow
1. `AGENTS.md`
2. `docs/fitness/README.md` (rulebook)
3. `docs/fitness/unit-test.md` and `docs/fitness/rust-api-test.md` (living checklist)
4. `git worktree` + incremental PR updates

## 规则（AI Verifier / 人工都按同一标准执行）

### 1) API Contract 变更规则
- 变更到的 HTTP 行为必须先在 `docs/fitness/rust-api-test.md` 上登记 endpoint 级条目。
- 每个新增/修改 endpoint 必须至少有：
  - 1 个正向用例（成功路径，含预期响应体字段）
  - 1 个负向用例（400/404/409/422 类中的任意一个或更多）
  - 1 个关键不变量断言（幂等性、鉴权/归属、状态一致性）
- 对于响应格式或错误码变更，必须补充“回归用例 + 旧行为断言”。
- 不允许只验证 status code；至少要有一次 `body` 结构或关键字段断言。

### 2) 领域行为规则
- 业务规则变化、状态映射变化、错误映射变化，必须至少有 1 个单元测试。
- 边界条件（非法输入、空输入、冲突状态）必须至少有 1 个失败用例。
- 可通过重构简化路径，不允许只靠“快照文本”冒充行为验证。

### 3) 测试数据与隔离规则
- 每条测试必须：
  - 明确前置数据（workspace/task/codebase/...）；
  - 明确清理策略（测试结束销毁临时数据/文件）；
  - 避免依赖外部服务，若必须依赖须标记为 `blocked`.
- 禁止“隐式共享状态”导致测试顺序相关；同一文件下测试应可并行顺序执行。

### 4) 证据优先规则
- 可执行性优先：所有条目必须指向 `crates/...` 的测试代码路径。
- 不可执行项必须标记为 `blocked`，并给出阻塞原因。
- 未执行/未更新条目视为未完成，不得计入得分。

### 5) Gate 规则
- 只有所有 `critical` 条目为 `VERIFIED` 才可进入审核通过流程。
- 任何 endpoint 的负向路径缺失会直接阻断关键合格条件。

## Fitness 评分模型（用于 AI Verifier）
- API Contract Completeness（40%）
- Business Unit Unit-Tests（30%）
- Negative-path Completeness（20%）
- Regression Evidence Stability（10%）

每项仅基于 `docs/fitness/unit-test.md` 与 `docs/fitness/rust-api-test.md` 上的已验证条目计分。
未验证条目按 0 分处理。

## 文件职责（只允许单一事实来源）
- `unit-test.md`：领域单元测试 + 集成测试责任清单（状态、阻塞、证据文件路径）。
- `rust-api-test.md`：API 契约矩阵（正向/负向/回归）、自动化命令与失败再现命令。
- 所有测试改动必须同步更新这两类清单之一。

## Core principle
- 用例价值优先：一条高价值行为回归优于多个低质量覆盖。

## 维护动作（每次提交前）
1. 更新本次影响到的条目；
2. 对新条目给出 `status: VERIFIED/BLOCKED/TODO`；
3. 在 PR 描述中引用对应条目和测试文件路径。
