type TxFn = (path: string[]) => string;

export type AnalyticsFilterOptionLabels = ReturnType<typeof buildAnalyticsFilterLabels>;

/** Builds the filter option labels object shared across all analytics views. */
export function buildAnalyticsFilterLabels(tx: TxFn): Record<string, string> {
  return {
    apply: tx(['filters', 'apply']),
    reset: tx(['filters', 'reset']),
    resetFilters: tx(['filters', 'resetFilters']),
    viewResults: tx(['filters', 'viewResults']),
    saveSearch: tx(['filters', 'saveSearch']),
    any: tx(['filters', 'any']),
    yes: tx(['filters', 'yes']),
    no: tx(['filters', 'no']),
    typeExpense: tx(['filters', 'typeExpense']),
    typeReport: tx(['filters', 'typeReport']),
    typeChat: tx(['filters', 'typeChat']),
    typeTrip: tx(['filters', 'typeTrip']),
    typeTask: tx(['filters', 'typeTask']),
    typeImage: tx(['filters', 'typeImage']),
    statusUnreported: tx(['filters', 'statusUnreported']),
    statusDraft: tx(['filters', 'statusDraft']),
    statusOutstanding: tx(['filters', 'statusOutstanding']),
    statusApproved: tx(['filters', 'statusApproved']),
    statusPaid: tx(['filters', 'statusPaid']),
    statusDone: tx(['filters', 'statusDone']),
    dateThisMonth: tx(['filters', 'dateThisMonth']),
    dateLastMonth: tx(['filters', 'dateLastMonth']),
    dateYearToDate: tx(['filters', 'dateYearToDate']),
    dateOn: tx(['filters', 'dateOn']),
    dateAfter: tx(['filters', 'dateAfter']),
    dateBefore: tx(['filters', 'dateBefore']),
    drawerTitle: tx(['filters', 'drawerTitle']),
    drawerGeneral: tx(['filters', 'drawerGeneral']),
    drawerExpenses: tx(['filters', 'drawerExpenses']),
    drawerReports: tx(['filters', 'drawerReports']),
    drawerGroupBy: tx(['filters', 'drawerGroupBy']),
    drawerHas: tx(['filters', 'drawerHas']),
    drawerKeywords: tx(['filters', 'drawerKeywords']),
    drawerLimit: tx(['filters', 'drawerLimit']),
    drawerTo: tx(['filters', 'drawerTo']),
    drawerAmount: tx(['filters', 'drawerAmount']),
    drawerApproved: tx(['filters', 'drawerApproved']),
    drawerBillable: tx(['filters', 'drawerBillable']),
    groupByDate: tx(['filters', 'groupByDate']),
    groupByStatus: tx(['filters', 'groupByStatus']),
    groupByType: tx(['filters', 'groupByType']),
    groupByBank: tx(['filters', 'groupByBank']),
    groupByUser: tx(['filters', 'groupByUser']),
    groupByAmount: tx(['filters', 'groupByAmount']),
    hasErrors: tx(['filters', 'hasErrors']),
    hasLogs: tx(['filters', 'hasLogs']),
    hasTransactions: tx(['filters', 'hasTransactions']),
    hasDateRange: tx(['filters', 'hasDateRange']),
    hasCurrency: tx(['filters', 'hasCurrency']),
  };
}

type FilterOption = { value: string; label: string };
type FilterOptionConst<T extends string> = { value: T; label: string };

type BuildAnalyticsFilterOptionsResult = {
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  datePresets: FilterOptionConst<'thisMonth' | 'lastMonth' | 'yearToDate'>[];
  dateModes: FilterOptionConst<'on' | 'after' | 'before'>[];
  groupByOptions: FilterOption[];
  hasOptions: FilterOption[];
};

/** Builds the filter option arrays used by FiltersDrawer and filter dropdowns. */
export function buildAnalyticsFilterOptions(
  labels: AnalyticsFilterOptionLabels,
): BuildAnalyticsFilterOptionsResult {
  const typeOptions = [
    { value: 'expense', label: labels.typeExpense },
    { value: 'expense_report', label: labels.typeReport },
    { value: 'chat', label: labels.typeChat },
    { value: 'trip', label: labels.typeTrip },
    { value: 'task', label: labels.typeTask },
    { value: 'pdf', label: 'PDF' },
    { value: 'xlsx', label: 'Excel' },
    { value: 'csv', label: 'CSV' },
    { value: 'image', label: labels.typeImage },
  ];

  const statusOptions = [
    { value: 'unreported', label: labels.statusUnreported },
    { value: 'draft', label: labels.statusDraft },
    { value: 'outstanding', label: labels.statusOutstanding },
    { value: 'approved', label: labels.statusApproved },
    { value: 'paid', label: labels.statusPaid },
    { value: 'done', label: labels.statusDone },
  ];

  const datePresets = [
    { value: 'thisMonth' as const, label: labels.dateThisMonth },
    { value: 'lastMonth' as const, label: labels.dateLastMonth },
    { value: 'yearToDate' as const, label: labels.dateYearToDate },
  ];

  const dateModes = [
    { value: 'on' as const, label: labels.dateOn },
    { value: 'after' as const, label: labels.dateAfter },
    { value: 'before' as const, label: labels.dateBefore },
  ];

  const groupByOptions = [
    { value: 'date', label: labels.groupByDate },
    { value: 'status', label: labels.groupByStatus },
    { value: 'type', label: labels.groupByType },
    { value: 'bank', label: labels.groupByBank },
    { value: 'user', label: labels.groupByUser },
    { value: 'amount', label: labels.groupByAmount },
  ];

  const hasOptions = [
    { value: 'errors', label: labels.hasErrors },
    { value: 'processingDetails', label: labels.hasLogs },
    { value: 'transactions', label: labels.hasTransactions },
    { value: 'dateRange', label: labels.hasDateRange },
    { value: 'currency', label: labels.hasCurrency },
  ];

  return { typeOptions, statusOptions, datePresets, dateModes, groupByOptions, hasOptions };
}

export const filterLinkClassName = 'seneca-view-page__filter-link';
