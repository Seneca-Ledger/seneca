/** The analytics pages' flow: what was spent, or what came in. */
export type AnalyticsFlowType = 'spend' | 'income';

/** Chart is the default; the table holds the exact figures. */
export type AnalyticsViewMode = 'chart' | 'table';

/** The labels every analytics header shows, from the page's label set. */
export type AnalyticsFlowHeaderLabels = {
  tabSpenders: string;
  tabIncomeSenders: string;
  viewChart: string;
  viewTable: string;
  viewModeLabel: string;
  flowTypeLabel: string;
};
