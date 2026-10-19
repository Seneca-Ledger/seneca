import {
  InsightCategory,
  InsightSeverity,
  type InsightType,
} from '../../../entities/insight.entity';
import type { InsightMessageKey } from '../insight-translations';

export type InsightActionType =
  | 'CREATE_RULE'
  | 'GO_TO_UNAPPROVED'
  | 'RUN_AI_CLASSIFICATION'
  | 'VIEW_REPORT'
  | 'DISMISS';

export interface InsightAction {
  type: InsightActionType;
  /** Optional override. Normally omitted — `type` is a stable enum the client
   * labels in its own locale, the same way it does for notification keys. */
  label?: string;
  payload?: Record<string, unknown>;
}

export interface AnalysisContext {
  userId: string;
  workspaceId: string | null;
}

interface InsightCandidateBase {
  type: InsightType;
  category: InsightCategory;
  severity: InsightSeverity;
  deduplicationKey: string;
  data?: Record<string, unknown>;
  actions?: InsightAction[];
  expiresAt?: Date | null;
}

/**
 * Analyzers describe an insight, they do not phrase it: the wording lives in
 * insight-translations.ts and is rendered in the recipient's locale by
 * InsightsService.
 */
export type InsightCandidate = InsightCandidateBase & {
  messageKey: InsightMessageKey;
  messageParams: Record<string, string | number>;
};

export interface InsightAnalyzer {
  analyze(context: AnalysisContext): Promise<InsightCandidate[]>;
}
