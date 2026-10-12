import type { GoalFlowResponse, GoalItemsResponse, GoalPlanResponse } from './contracts';
import { apiQueryDecoded } from './query-fn-schema';

export type {
  BudgetPeriodType,
  CreateGoalItemBody as GoalItemPayload,
  GoalFlowBudget,
  GoalFlowLink,
  GoalFlowNode,
  GoalFlowNodeKind,
  GoalFlowResponse,
  GoalItem,
  GoalItemStatus,
  GoalItemsResponse,
  GoalPlanResponse,
  GoalPlanStatus,
} from './contracts';

export function fetchGoalFlow(
  goalId: string,
  month: string,
  signal?: AbortSignal,
): Promise<GoalFlowResponse> {
  return apiQueryDecoded({
    url: `/goals/${goalId}/flow`,
    params: { month },
    signal,
    contract: 'GoalFlowResponse',
  });
}

export function fetchGoalPlan(goalId: string, signal?: AbortSignal): Promise<GoalPlanResponse> {
  return apiQueryDecoded({ url: `/goals/${goalId}/plan`, signal, contract: 'GoalPlanResponse' });
}

export function fetchGoalItems(goalId: string, signal?: AbortSignal): Promise<GoalItemsResponse> {
  return apiQueryDecoded({ url: `/goals/${goalId}/items`, signal, contract: 'GoalItemsResponse' });
}
