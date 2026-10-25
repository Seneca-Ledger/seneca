import { formatLabel } from '../editHelpers';

type Labels = Record<string, { value: string }>;

export type ReadinessMessageParams = {
  hasStatementCategory: boolean;
  hasDisabledStatementCategory: boolean;
  missingCategoryCount: number;
  parsingErrorCount: number;
  parsingWarningCount: number;
  transactionsCount: number;
  labels: Labels;
};

export function buildReadinessTitle(
  severity: 'success' | 'warning' | 'error',
  labels: Labels,
): string {
  if (severity === 'error') {
    return labels.alertNeedsFixTitle.value;
  }
  if (severity === 'warning') {
    return labels.alertReviewTitle.value;
  }
  return labels.alertReadyTitle.value;
}

function buildCategoryMsgs(p: ReadinessMessageParams): string[] {
  const msgs: string[] = [];
  if (!p.hasStatementCategory) {
    msgs.push(p.labels.alertStatementCategoryMissing.value);
  }
  if (p.hasDisabledStatementCategory) {
    msgs.push(p.labels.alertStatementCategoryDisabled.value);
  }
  if (p.missingCategoryCount > 0) {
    msgs.push(
      formatLabel(p.labels.alertTransactionsCategoryMissing.value, {
        count: p.missingCategoryCount,
      }),
    );
  }
  return msgs;
}

function buildParsingMsgs(p: ReadinessMessageParams): string[] {
  const msgs: string[] = [];
  if (p.parsingErrorCount > 0) {
    msgs.push(
      formatLabel(p.labels.alertParsingErrors.value, {
        count: p.parsingErrorCount,
      }),
    );
  }
  if (p.parsingWarningCount > 0) {
    msgs.push(
      formatLabel(p.labels.alertParsingWarnings.value, {
        count: p.parsingWarningCount,
      }),
    );
  }
  if (!p.transactionsCount) {
    msgs.push(p.labels.alertNoTransactions.value);
  }
  return msgs;
}

export function buildReadinessMessage(params: ReadinessMessageParams): string {
  const details = [...buildCategoryMsgs(params), ...buildParsingMsgs(params)];
  const fallback = params.labels.alertReadyBody.value;
  return details.length > 0 ? details.join(' · ') : fallback;
}
