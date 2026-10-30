import type { CategorizationRule } from '../../../entities/categorization-rule.entity';
import type { ClassificationCondition } from '../interfaces/classification-rule.interface';

export type CategorizationRuleAuditSnapshot = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  conditions: ClassificationCondition[];
  result: CategorizationRule['result'];
  priority: number;
  isActive: boolean;
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A rule as the audit trail keeps it, before and after a change. */
export function toRuleAuditSnapshot(rule: CategorizationRule): CategorizationRuleAuditSnapshot {
  return {
    id: rule.id,
    userId: rule.userId,
    workspaceId: rule.workspaceId,
    name: rule.name,
    description: rule.description,
    conditions: rule.conditions,
    result: rule.result,
    priority: rule.priority,
    isActive: rule.isActive,
    matchCount: rule.matchCount,
    lastMatchedAt: rule.lastMatchedAt?.toISOString() || null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}
