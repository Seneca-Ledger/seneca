type TxFn = (path: string[], fallback: string) => string;

export type AnalyticsFilterOptionLabels = ReturnType<typeof buildAnalyticsFilterLabels>;

/** Builds the filter option labels object shared across all analytics views. */
export function buildAnalyticsFilterLabels(tx: TxFn): Record<string, string> {
  return {
    apply: tx(['filters', 'apply'], 'Apply'),
    reset: tx(['filters', 'reset'], 'Reset'),
    resetFilters: tx(['filters', 'resetFilters'], 'Reset filters'),
    viewResults: tx(['filters', 'viewResults'], 'View results'),
    saveSearch: tx(['filters', 'saveSearch'], 'Save search'),
    any: tx(['filters', 'any'], 'Any'),
    yes: tx(['filters', 'yes'], 'Yes'),
    no: tx(['filters', 'no'], 'No'),
    typeExpense: tx(['filters', 'typeExpense'], 'Expense'),
    typeReport: tx(['filters', 'typeReport'], 'Expense Report'),
    typeChat: tx(['filters', 'typeChat'], 'Chat'),
    typeTrip: tx(['filters', 'typeTrip'], 'Trip'),
    typeTask: tx(['filters', 'typeTask'], 'Task'),
    typeImage: tx(['filters', 'typeImage'], 'Image'),
    statusUnreported: tx(['filters', 'statusUnreported'], 'Unreported'),
    statusDraft: tx(['filters', 'statusDraft'], 'Draft'),
    statusOutstanding: tx(['filters', 'statusOutstanding'], 'Outstanding'),
    statusApproved: tx(['filters', 'statusApproved'], 'Approved'),
    statusPaid: tx(['filters', 'statusPaid'], 'Paid'),
    statusDone: tx(['filters', 'statusDone'], 'Done'),
    dateThisMonth: tx(['filters', 'dateThisMonth'], 'This month'),
    dateLastMonth: tx(['filters', 'dateLastMonth'], 'Last month'),
    dateYearToDate: tx(['filters', 'dateYearToDate'], 'Year to date'),
    dateOn: tx(['filters', 'dateOn'], 'On'),
    dateAfter: tx(['filters', 'dateAfter'], 'After'),
    dateBefore: tx(['filters', 'dateBefore'], 'Before'),
    drawerTitle: tx(['filters', 'drawerTitle'], 'Filters'),
    drawerGeneral: tx(['filters', 'drawerGeneral'], 'General'),
    drawerExpenses: tx(['filters', 'drawerExpenses'], 'Expenses'),
    drawerReports: tx(['filters', 'drawerReports'], 'Reports'),
    drawerGroupBy: tx(['filters', 'drawerGroupBy'], 'Group by'),
    drawerHas: tx(['filters', 'drawerHas'], 'Has'),
    drawerKeywords: tx(['filters', 'drawerKeywords'], 'Keywords'),
    drawerLimit: tx(['filters', 'drawerLimit'], 'Limit'),
    drawerTo: tx(['filters', 'drawerTo'], 'To'),
    drawerAmount: tx(['filters', 'drawerAmount'], 'Amount'),
    drawerApproved: tx(['filters', 'drawerApproved'], 'Approved'),
    drawerBillable: tx(['filters', 'drawerBillable'], 'Billable'),
    groupByDate: tx(['filters', 'groupByDate'], 'Date'),
    groupByStatus: tx(['filters', 'groupByStatus'], 'Status'),
    groupByType: tx(['filters', 'groupByType'], 'Type'),
    groupByBank: tx(['filters', 'groupByBank'], 'Bank'),
    groupByUser: tx(['filters', 'groupByUser'], 'User'),
    groupByAmount: tx(['filters', 'groupByAmount'], 'Amount'),
    hasErrors: tx(['filters', 'hasErrors'], 'Errors'),
    hasLogs: tx(['filters', 'hasLogs'], 'Logs'),
    hasTransactions: tx(['filters', 'hasTransactions'], 'Transactions'),
    hasDateRange: tx(['filters', 'hasDateRange'], 'Date range'),
    hasCurrency: tx(['filters', 'hasCurrency'], 'Currency'),
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
