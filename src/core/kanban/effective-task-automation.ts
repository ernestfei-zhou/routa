import {
  getKanbanAutomationSteps,
  type KanbanTransport,
  type KanbanAutomationStep,
  type KanbanColumnAutomation,
} from "../models/kanban";

export interface AutomationSpecialistSummary {
  name?: string;
  role?: string;
  defaultProvider?: string;
}

export type AutomationSpecialistResolver = (
  specialistId: string,
  locale?: string,
) => AutomationSpecialistSummary | undefined;

export type EffectiveAutomationProviderSource = "card" | "lane" | "auto" | "specialist" | "none";

export interface ResolveAutomationOptions {
  autoProviderId?: string;
}

type TaskAutomationFields = {
  columnId?: string;
  assignedProvider?: string;
  assignedRole?: string;
  assignedSpecialistId?: string;
  assignedSpecialistName?: string;
};

type ColumnAutomationFields = {
  id: string;
  automation?: KanbanColumnAutomation;
};

export interface ResolvedKanbanAutomationStep extends KanbanAutomationStep {
  providerSource?: Exclude<EffectiveAutomationProviderSource, "card">;
  specialistDefaultProviderId?: string;
}

export interface EffectiveTaskAutomation {
  canRun: boolean;
  source: "card" | "lane" | "none";
  laneAutomation?: KanbanColumnAutomation;
  steps: ResolvedKanbanAutomationStep[];
  stepIndex?: number;
  step?: ResolvedKanbanAutomationStep;
  transport?: KanbanTransport;
  providerId?: string;
  providerSource?: EffectiveAutomationProviderSource;
  role?: string;
  specialistId?: string;
  specialistName?: string;
  agentCardUrl?: string;
  skillId?: string;
  authConfigId?: string;
}

function normalizeProviderId(providerId: string | null | undefined): string | undefined {
  const normalized = providerId?.trim();
  return normalized ? normalized : undefined;
}

export function resolveKanbanAutomationStep(
  step: KanbanAutomationStep | undefined,
  resolveSpecialist?: AutomationSpecialistResolver,
  options: ResolveAutomationOptions = {},
): ResolvedKanbanAutomationStep | undefined {
  if (!step) return undefined;
  const specialist = step.specialistId
    ? resolveSpecialist?.(step.specialistId, step.specialistLocale)
    : undefined;
  const transport = step.transport === "a2a" ? "acp" : (step.transport ?? "acp");
  const configuredProviderId = normalizeProviderId(step.providerId);
  const autoProviderId = normalizeProviderId(options.autoProviderId);
  const specialistDefaultProviderId = normalizeProviderId(specialist?.defaultProvider);
  const providerId = configuredProviderId ?? autoProviderId ?? specialistDefaultProviderId;
  const providerSource = configuredProviderId
    ? "lane"
    : autoProviderId
      ? "auto"
      : specialistDefaultProviderId
        ? "specialist"
        : "none";

  return {
    ...step,
    transport,
    providerId,
    providerSource,
    specialistDefaultProviderId,
    role: step.role ?? specialist?.role,
    specialistName: step.specialistName ?? specialist?.name,
  };
}

export function resolveEffectiveTaskAutomation(
  task: TaskAutomationFields,
  boardColumns: ColumnAutomationFields[] = [],
  resolveSpecialist?: AutomationSpecialistResolver,
  options: ResolveAutomationOptions = {},
): EffectiveTaskAutomation {
  const currentColumnId = task.columnId ?? "backlog";
  const laneAutomation = boardColumns.find((column) => column.id === currentColumnId)?.automation;
  const enabledLaneAutomation = laneAutomation?.enabled ? laneAutomation : undefined;
  const hasCardOverride = Boolean(
    task.assignedProvider
      || task.assignedRole
      || task.assignedSpecialistId
      || task.assignedSpecialistName,
  );
  const canRun = hasCardOverride || Boolean(enabledLaneAutomation);
  const rawSteps = hasCardOverride
    ? [{
      id: "card-override",
      providerId: task.assignedProvider,
      role: task.assignedRole,
      specialistId: task.assignedSpecialistId,
      specialistName: task.assignedSpecialistName,
    }]
    : getKanbanAutomationSteps(enabledLaneAutomation);
  const steps = rawSteps
    .map((step) => resolveKanbanAutomationStep(step, resolveSpecialist, options))
    .filter((step): step is ResolvedKanbanAutomationStep => Boolean(step));
  const step = steps[0];
  const providerSource: EffectiveAutomationProviderSource = normalizeProviderId(task.assignedProvider)
    ? "card"
    : step?.providerSource ?? "none";

  return {
    canRun,
    source: hasCardOverride ? "card" : enabledLaneAutomation ? "lane" : "none",
    laneAutomation: enabledLaneAutomation,
    steps,
    stepIndex: step ? 0 : undefined,
    step,
    transport: step?.transport ?? (canRun ? "acp" : undefined),
    providerId: normalizeProviderId(task.assignedProvider) ?? step?.providerId,
    providerSource,
    role: task.assignedRole ?? step?.role ?? (canRun ? "DEVELOPER" : undefined),
    specialistId: task.assignedSpecialistId ?? step?.specialistId,
    specialistName: task.assignedSpecialistName ?? step?.specialistName,
    agentCardUrl: step?.agentCardUrl,
    skillId: step?.skillId,
    authConfigId: step?.authConfigId,
  };
}
