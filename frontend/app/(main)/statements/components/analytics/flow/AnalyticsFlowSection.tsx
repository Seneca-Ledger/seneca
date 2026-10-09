'use client';

import { useMemo } from 'react';
import type { AnalyticsFlowType } from '@/app/(main)/statements/components/analytics/flow/analytics-flow.types';
import { SpendFlowChart } from '@/app/(main)/statements/components/analytics/flow/SpendFlowChart';
import type { SpendFlowGroupBy } from '@/app/(main)/statements/components/analytics/flow/useSpendFlow';

const SUBTITLE_KEY: Record<SpendFlowGroupBy, string> = {
  'category-merchant': 'flowSubtitle',
  'category-subcategory': 'flowSubtitleCategories',
  merchant: 'flowSubtitleMerchants',
};

type Props = {
  groupBy: SpendFlowGroupBy;
  flowType: AnalyticsFlowType;
  month: Date;
  resolvedTheme: string | undefined;
  /** The page's label set; it includes FLOW_LABEL_PATHS. */
  labels: Record<string, string>;
  /** A second-column label to blink twice, for a `?focus=` deep link. */
  flashNodeName?: string | null;
};

/** The chart mode of an analytics page: one sankey card wired to the page's labels. */
export function AnalyticsFlowSection({
  groupBy,
  flowType,
  month,
  resolvedTheme,
  labels,
  flashNodeName = null,
}: Props): React.JSX.Element {
  const isIncome = flowType === 'income';
  const chartLabels = useMemo(
    () => ({
      total: isIncome ? labels.flowTotalIncome : labels.flowTotalSpend,
      uncategorised: labels.flowUncategorised,
      unknownMerchant: labels.flowUnknownMerchant,
      noSubcategory: labels.flowNoSubcategory,
      otherMerchants: labels.flowOtherMerchants,
      otherCategories: labels.flowOtherCategories,
    }),
    [labels, isIncome],
  );
  const emptyLabels = useMemo(
    () => ({
      emptyMonthSpend: labels.emptyMonthSpend,
      emptyMonthIncome: labels.emptyMonthIncome,
      emptyMonthHint: labels.emptyMonthHint,
    }),
    [labels],
  );
  return (
    <SpendFlowChart
      groupBy={groupBy}
      type={isIncome ? 'income' : 'expense'}
      month={month}
      resolvedTheme={resolvedTheme}
      title={isIncome ? labels.flowIncomeTitle : labels.flowTitle}
      subtitle={labels[SUBTITLE_KEY[groupBy]]}
      chartLabels={chartLabels}
      emptyLabels={emptyLabels}
      errorLabel={labels.flowError}
      flashNodeName={flashNodeName}
    />
  );
}
