'use client';

import { useIntlayer } from '@/app/i18n';
import { resolveLabel } from '@/app/lib/side-panel-utils';

type I18nNode = Record<string, unknown>;

function getNestedT(t: I18nNode, path: string[]): unknown {
  return path.reduce((acc: I18nNode | unknown, key) => {
    if (acc !== null && typeof acc === 'object') {
      return (acc as I18nNode)[key];
    }
    return undefined;
  }, t as unknown);
}

export interface StatementLabels {
  searchPlaceholder: string;
  filterLabels: {
    type: string;
    status: string;
    date: string;
    from: string;
    filters: string;
    columns: string;
  };
  listHeaderLabels: {
    receipt: string;
    type: string;
    date: string;
    merchant: string;
    amount: string;
    action: string;
    scanning: string;
  };
  viewLabel: string;
  reviewDuplicateLabel: string;
  markDuplicateLabel: string;
  dismissDuplicateLabel: string;
  mergeDuplicatesLabel: string;
  selectDuplicatesLabel: string;
  emptyLabels: { title: string; description: string };
  paginationLabels: { shown: string; previous: string; next: string; pageOf: string };
  filterOptionLabels: Record<string, string>;
  uploadLabels: { pickAtLeastOne: string; uploadedProcessing: string; uploadFailed: string };
  loadListErrorLabel: string;
  refreshFailedLabel: string;
}

function buildFilterLabels(t: I18nNode): StatementLabels['filterLabels'] {
  return {
    type: resolveLabel(getNestedT(t, ['filters', 'type']), 'Type'),
    status: resolveLabel(getNestedT(t, ['filters', 'status']), 'Status'),
    date: resolveLabel(getNestedT(t, ['filters', 'date']), 'Date'),
    from: resolveLabel(getNestedT(t, ['filters', 'from']), 'From'),
    filters: resolveLabel(getNestedT(t, ['filters', 'filters']), 'Filters'),
    columns: resolveLabel(getNestedT(t, ['filters', 'columns']), 'Columns'),
  };
}

function buildListHeaderLabels(t: I18nNode): StatementLabels['listHeaderLabels'] {
  const lh = getNestedT(t, ['listHeader']) as I18nNode;
  return {
    receipt: resolveLabel(lh?.receipt, 'Receipt'),
    type: resolveLabel(lh?.type, 'Type'),
    date: resolveLabel(lh?.date, 'Date'),
    merchant: resolveLabel(lh?.merchant, 'Merchant'),
    amount: resolveLabel(lh?.amount, 'Amount'),
    action: resolveLabel(lh?.action, 'Action'),
    scanning: resolveLabel(lh?.scanning, 'Scanning...'),
  };
}

function buildFilterOptionLabelsA(t: I18nNode): Record<string, string> {
  const tx = (p: string[], fb: string): string => resolveLabel(getNestedT(t, p), fb);
  return {
    apply: tx(['filters', 'apply'], 'Apply'),
    reset: tx(['filters', 'reset'], 'Reset'),
    resetFilters: tx(['filters', 'resetFilters'], 'Reset filters'),
    viewResults: tx(['filters', 'viewResults'], 'View results'),
    save: tx(['filters', 'save'], 'Save'),
    saveSearch: tx(['filters', 'saveSearch'], 'Save search'),
    any: tx(['filters', 'any'], 'Any'),
    yes: tx(['filters', 'yes'], 'Yes'),
    no: tx(['filters', 'no'], 'No'),
    typeExpense: tx(['filters', 'typeExpense'], 'Expense'),
    typeReport: tx(['filters', 'typeReport'], 'Expense Report'),
  };
}

function buildFilterOptionLabelsB(t: I18nNode): Record<string, string> {
  const tx = (p: string[], fb: string): string => resolveLabel(getNestedT(t, p), fb);
  return {
    typeChat: tx(['filters', 'typeChat'], 'Chat'),
    typeTrip: tx(['filters', 'typeTrip'], 'Trip'),
    typeTask: tx(['filters', 'typeTask'], 'Task'),
    statusUploaded: tx(['filters', 'statusUploaded'], 'Uploaded'),
    statusProcessing: tx(['filters', 'statusProcessing'], 'Processing'),
    statusParsed: tx(['filters', 'statusParsed'], 'Parsed'),
    statusValidated: tx(['filters', 'statusValidated'], 'Validated'),
    statusCompleted: tx(['filters', 'statusCompleted'], 'Completed'),
    statusError: tx(['filters', 'statusError'], 'Error'),
    dateThisMonth: tx(['filters', 'dateThisMonth'], 'This month'),
    dateLastMonth: tx(['filters', 'dateLastMonth'], 'Last month'),
  };
}

function buildFilterOptionLabelsC(t: I18nNode): Record<string, string> {
  const tx = (p: string[], fb: string): string => resolveLabel(getNestedT(t, p), fb);
  return {
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
  };
}

function buildFilterOptionLabelsD(t: I18nNode): Record<string, string> {
  const tx = (p: string[], fb: string): string => resolveLabel(getNestedT(t, p), fb);
  return {
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
  };
}

function buildFilterOptionLabelsE(t: I18nNode): Record<string, string> {
  const tx = (p: string[], fb: string): string => resolveLabel(getNestedT(t, p), fb);
  return {
    hasErrors: tx(['filters', 'hasErrors'], 'Errors'),
    hasLogs: tx(['filters', 'hasLogs'], 'Logs'),
    hasTransactions: tx(['filters', 'hasTransactions'], 'Transactions'),
    hasDateRange: tx(['filters', 'hasDateRange'], 'Date range'),
    hasCurrency: tx(['filters', 'hasCurrency'], 'Currency'),
    columnReceipt: tx(['filters', 'columnReceipt'], 'Receipt'),
    columnDate: tx(['filters', 'columnDate'], 'Date'),
    columnMerchant: tx(['filters', 'columnMerchant'], 'Merchant'),
    columnFrom: tx(['filters', 'columnFrom'], 'From'),
    columnTo: tx(['filters', 'columnTo'], 'To'),
    columnCategory: tx(['filters', 'columnCategory'], 'Category'),
  };
}

function buildFilterOptionLabelsF(t: I18nNode): Record<string, string> {
  const tx = (p: string[], fb: string): string => resolveLabel(getNestedT(t, p), fb);
  return {
    columnTag: tx(['filters', 'columnTag'], 'Tag'),
    columnAmount: tx(['filters', 'columnAmount'], 'Amount'),
    columnAction: tx(['filters', 'columnAction'], 'Action'),
    columnApproved: tx(['filters', 'columnApproved'], 'Approved'),
    columnBillable: tx(['filters', 'columnBillable'], 'Billable'),
    columnCard: tx(['filters', 'columnCard'], 'Card'),
    columnDescription: tx(['filters', 'columnDescription'], 'Description'),
    columnExchangeRate: tx(['filters', 'columnExchangeRate'], 'Exchange rate'),
    columnExported: tx(['filters', 'columnExported'], 'Exported'),
    columnsTitle: tx(['filters', 'columnsTitle'], 'Columns'),
    paid: tx(['filters', 'paid'], 'Paid'),
  };
}

export function useStatementLabels(): StatementLabels {
  const t = useIntlayer('statementsPage') as I18nNode;
  const tx = (p: string[], fb: string): string => resolveLabel(getNestedT(t, p), fb);

  const filterOptionLabels = {
    ...buildFilterOptionLabelsA(t),
    ...buildFilterOptionLabelsB(t),
    ...buildFilterOptionLabelsC(t),
    ...buildFilterOptionLabelsD(t),
    ...buildFilterOptionLabelsE(t),
    ...buildFilterOptionLabelsF(t),
  };

  const actions = getNestedT(t, ['actions']) as I18nNode;
  const uploadModal = getNestedT(t, ['uploadModal']) as I18nNode;

  return {
    searchPlaceholder: resolveLabel(getNestedT(t, ['searchPlaceholder']), 'Search statements'),
    filterLabels: buildFilterLabels(t),
    listHeaderLabels: buildListHeaderLabels(t),
    viewLabel: resolveLabel(actions?.view, 'View'),
    reviewDuplicateLabel: tx(['actions', 'reviewDuplicate'], 'Review'),
    markDuplicateLabel: tx(['actions', 'markDuplicate'], 'Mark as duplicate'),
    dismissDuplicateLabel: tx(['actions', 'dismissDuplicate'], 'Dismiss'),
    mergeDuplicatesLabel: tx(['actions', 'mergeDuplicates'], 'Merge duplicates'),
    selectDuplicatesLabel: tx(['actions', 'selectDuplicates'], 'Select duplicates'),
    emptyLabels: {
      title: resolveLabel(getNestedT(t, ['empty', 'title']), 'No statements yet'),
      description: resolveLabel(
        getNestedT(t, ['empty', 'description']),
        'Upload your first statement to get started',
      ),
    },
    paginationLabels: {
      shown: tx(['pagination', 'shown'], 'Showing {from}–{to} of {count}'),
      previous: tx(['pagination', 'previous'], 'Previous'),
      next: tx(['pagination', 'next'], 'Next'),
      pageOf: tx(['pagination', 'pageOf'], 'Page {page} of {count}'),
    },
    filterOptionLabels,
    uploadLabels: {
      pickAtLeastOne: resolveLabel(uploadModal?.pickAtLeastOne, 'Select at least one file'),
      uploadedProcessing: resolveLabel(uploadModal?.uploadedProcessing, 'Files uploaded'),
      uploadFailed: resolveLabel(uploadModal?.uploadFailed, 'Failed to upload files'),
    },
    loadListErrorLabel: resolveLabel(getNestedT(t, ['loadListError']), 'Failed to load statements'),
    refreshFailedLabel: resolveLabel(
      getNestedT(t, ['refreshFailed']),
      'Failed to refresh statements',
    ),
  };
}
