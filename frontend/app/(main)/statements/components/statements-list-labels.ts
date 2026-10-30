import type { StatementUploadLabels } from './statement-upload';
import { FilterLabels, FilterOptionLabels } from './statements-list.types';

export type IntlayerDict = any;
export type TxFn = (path: string[]) => string;

export const buildFilterLabels = (t: IntlayerDict): FilterLabels => ({
  type: t.filters.type.value,
  status: t.filters.status.value,
  date: t.filters.date.value,
  from: t.filters.from.value,
  filters: t.filters.filters.value,
  columns: t.filters.columns.value,
});

export const buildListHeaderLabels = (t: IntlayerDict): Record<string, string> => ({
  receipt: t.listHeader.receipt.value,
  type: t.listHeader.type.value,
  date: t.listHeader.date.value,
  merchant: t.listHeader.merchant.value,
  amount: t.listHeader.amount.value,
  action: t.listHeader.action.value,
  scanning: t.listHeader.scanning.value,
});

export const buildPaginationLabels = (tx: TxFn): Record<string, string> => ({
  shown: tx(['pagination', 'shown']),
  previous: tx(['pagination', 'previous']),
  next: tx(['pagination', 'next']),
  pageOf: tx(['pagination', 'pageOf']),
});

export const buildUploadLabels = (t: IntlayerDict): StatementUploadLabels => ({
  pickAtLeastOne: t.uploadModal.pickAtLeastOne.value,
  uploadedProcessing: t.uploadModal.uploadedProcessing.value,
  uploadFailed: t.uploadModal.uploadFailed.value,
});

export const buildFilterOptionLabels = (_t: IntlayerDict, tx: TxFn): FilterOptionLabels => ({
  apply: tx(['filters', 'apply']),
  reset: tx(['filters', 'reset']),
  resetFilters: tx(['filters', 'resetFilters']),
  viewResults: tx(['filters', 'viewResults']),
  save: tx(['filters', 'save']),
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
  statusUploaded: tx(['filters', 'statusUploaded']),
  statusProcessing: tx(['filters', 'statusProcessing']),
  statusParsed: tx(['filters', 'statusParsed']),
  statusValidated: tx(['filters', 'statusValidated']),
  statusCompleted: tx(['filters', 'statusCompleted']),
  statusError: tx(['filters', 'statusError']),
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
  columnReceipt: tx(['filters', 'columnReceipt']),
  columnDate: tx(['filters', 'columnDate']),
  columnMerchant: tx(['filters', 'columnMerchant']),
  columnFrom: tx(['filters', 'columnFrom']),
  columnTo: tx(['filters', 'columnTo']),
  columnCategory: tx(['filters', 'columnCategory']),
  columnTag: tx(['filters', 'columnTag']),
  columnAmount: tx(['filters', 'columnAmount']),
  columnAction: tx(['filters', 'columnAction']),
  columnApproved: tx(['filters', 'columnApproved']),
  columnBillable: tx(['filters', 'columnBillable']),
  columnCard: tx(['filters', 'columnCard']),
  columnDescription: tx(['filters', 'columnDescription']),
  columnExchangeRate: tx(['filters', 'columnExchangeRate']),
  columnExported: tx(['filters', 'columnExported']),
  columnsTitle: tx(['filters', 'columnsTitle']),
  paid: tx(['filters', 'paid']),
});

export const buildColumnLabels = (labels: Record<string, string>): Record<string, string> => ({
  receipt: labels.columnReceipt,
  merchant: labels.columnMerchant,
  from: labels.columnFrom,
  to: labels.columnTo,
  category: labels.columnCategory,
  tag: labels.columnTag,
  amount: labels.columnAmount,
  action: labels.columnAction,
  approved: labels.columnApproved,
  billable: labels.columnBillable,
  card: labels.columnCard,
  description: labels.columnDescription,
  exchangeRate: labels.columnExchangeRate,
  exported: labels.columnExported,
});

export interface StatementForFromOptions {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  bankName: string;
  source?: string;
  receiptSource?: string;
}
