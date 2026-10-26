import { resolveBankLogo } from '@bank-logos';
import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import { resolveStatementViewAction } from '@/app/(main)/statements/components/StatementsListView.utils';
import { resolveSourceChannel } from '@/app/(main)/statements/components/shared-analytics.utils';
import type { SpendOverTimeRecord } from '@/app/(main)/statements/components/spend-over-time.utils';
import { resolveSpendOverTimeFlow } from '@/app/(main)/statements/components/spend-over-time.utils';
import type {
  ReceiptDocument,
  StatementMeta,
  Transaction,
} from '@/app/(main)/statements/types/statement-types';
import {
  getTransactionCurrency,
  getTransactionDate,
  resolveCurrencyCode,
} from '@/app/lib/analytics-common';
import { resolveReceiptMerchantLabel } from '@/app/lib/receipt-merchant';

// ---------------------------------------------------------------------------
// Bank display name helper (reused for fromOptions)
// ---------------------------------------------------------------------------

export const getBankDisplayName = (bankName?: string | null): string => {
  const raw = (bankName ?? '').trim();
  if (!raw) {
    return 'Unknown';
  }
  const resolved = resolveBankLogo(raw);
  if (!resolved) {
    return raw;
  }
  return resolved.key !== 'other' ? resolved.displayName : raw;
};

// ---------------------------------------------------------------------------
// Meta field helpers — each max complexity 5 to stay under the 6 limit
// ---------------------------------------------------------------------------

const opt = (v: string | null | undefined): string | null => (v ? v : null);

const getMetaStatus = (meta: StatementMeta | undefined): string | null => opt(meta?.status);
const getMetaBankName = (meta: StatementMeta | undefined): string | null => opt(meta?.bankName);
const getMetaDateTo = (meta: StatementMeta | undefined): string | null =>
  opt(meta?.statementDateTo);
const getMetaCreatedAt = (meta: StatementMeta | undefined, item: Transaction): string | null =>
  opt(meta?.createdAt) ?? opt(item.createdAt);
const getMetaDateFrom = (meta: StatementMeta | undefined, item: Transaction): string | null =>
  opt(meta?.statementDateFrom) ?? opt(item.transactionDate);

type MetaExportedPaid = { exported: boolean | null; paid: boolean | null };
const getMetaExportedPaid = (meta: StatementMeta | undefined): MetaExportedPaid => ({
  exported: meta?.exported ?? null,
  paid: meta?.paid ?? null,
});

type MetaParsingUser = {
  parsingDetails: StatementFilterItem['parsingDetails'];
  user: StatementFilterItem['user'];
};
const getMetaParsingUser = (meta: StatementMeta | undefined): MetaParsingUser => ({
  parsingDetails: (meta?.parsingDetails ?? null) as StatementFilterItem['parsingDetails'],
  user: (meta?.user ?? null) as StatementFilterItem['user'],
});

type MetaWorkspace = { workspaceId: string | undefined; workspaceName: string | undefined };
const getMetaWorkspace = (meta: StatementMeta | undefined, item: Transaction): MetaWorkspace => ({
  workspaceId: meta?.workspaceId ?? item.workspaceId,
  workspaceName: meta?.workspaceName ?? item.workspaceName,
});

type FlowAmounts = { totalDebit: number | null; totalCredit: number | null };
const getFlowAmounts = (flow: ReturnType<typeof resolveSpendOverTimeFlow>): FlowAmounts => ({
  totalDebit: flow.flowType === 'expense' ? flow.amount : null,
  totalCredit: flow.flowType === 'income' ? flow.amount : null,
});

const buildTxFileType = (meta: StatementMeta | undefined, item: Transaction): string =>
  ((meta?.fileType ?? item.transactionType ?? 'expense') as string).toLowerCase();

const buildTxMerchant = (item: Transaction): string =>
  (item.counterpartyName ?? '').trim() || 'Unknown';

// ---------------------------------------------------------------------------
// Transaction record builder
// ---------------------------------------------------------------------------

type TxRecordInput = {
  item: Transaction;
  meta: StatementMeta | undefined;
  merchant: string;
  fileType: string;
  flow: ReturnType<typeof resolveSpendOverTimeFlow>;
  currency: string;
  dateValue: string;
};

const buildTransactionSpendRecord = ({
  item,
  meta,
  merchant,
  fileType,
  flow,
  currency,
  dateValue,
}: TxRecordInput): SpendOverTimeRecord => {
  const ep = getMetaExportedPaid(meta);
  const pu = getMetaParsingUser(meta);
  const ws = getMetaWorkspace(meta, item);
  const fa = getFlowAmounts(flow);
  return {
    id: item.id,
    source: 'statement',
    fileName: merchant,
    subject: null,
    sender: null,
    status: getMetaStatus(meta),
    fileType,
    createdAt: getMetaCreatedAt(meta, item),
    statementDateFrom: getMetaDateFrom(meta, item),
    statementDateTo: getMetaDateTo(meta),
    bankName: getMetaBankName(meta),
    totalDebit: fa.totalDebit,
    totalCredit: fa.totalCredit,
    currency,
    exported: ep.exported,
    paid: ep.paid,
    parsingDetails: pu.parsingDetails,
    user: pu.user,
    receivedAt: null,
    parsedData: { vendor: merchant, date: item.transactionDate ?? null },
    sourceType: 'statement',
    sourceChannel: resolveSourceChannel({
      sourceType: 'statement',
      fileType,
      isCrypto: Boolean(item.cryptoWalletId),
    }),
    flowType: flow.flowType,
    amount: flow.amount,
    currencyValue: currency,
    dateValue,
    transactionId: item.id,
    workspaceId: ws.workspaceId,
    workspaceName: ws.workspaceName,
    merchant,
    paymentPurpose: item.paymentPurpose ?? null,
    href: item.statementId
      ? resolveStatementViewAction({ id: item.statementId, status: getMetaStatus(meta) ?? '' }).href
      : null,
  };
};

export const mapTransactionToSpendRecord = (
  item: Transaction,
  meta: StatementMeta | undefined,
  workspaceCurrency: string,
): SpendOverTimeRecord | null => {
  const flow = resolveSpendOverTimeFlow({
    sourceType: 'statement',
    debit: item.debit,
    credit: item.credit,
    amount: item.amount,
    transactionType: item.transactionType,
  });
  if (flow.amount <= 0) {
    return null;
  }
  const merchant = buildTxMerchant(item);
  const fileType = buildTxFileType(meta, item);
  const currency = getTransactionCurrency(item, meta, workspaceCurrency);
  const dateValue = getTransactionDate(item, meta);
  return buildTransactionSpendRecord({ item, meta, merchant, fileType, flow, currency, dateValue });
};

// ---------------------------------------------------------------------------
// Receipt mapper
// ---------------------------------------------------------------------------

type ReceiptParsedFields = {
  amount?: number;
  transactionType?: 'income' | 'expense' | 'transfer' | 'unknown';
  vendor?: string;
  date?: string;
  currency?: string;
};

const extractReceiptParsed = (receipt: ReceiptDocument): ReceiptParsedFields => ({
  amount: receipt.parsedData?.amount,
  transactionType: receipt.parsedData?.transactionType,
  vendor: receipt.parsedData?.vendor,
  date: receipt.parsedData?.date,
  currency: receipt.parsedData?.currency,
});

const resolveReceiptDateValue = (parsedDate?: string, receivedAt?: string | null): string =>
  parsedDate ?? receivedAt ?? '';

type ReceiptSpendRecordInput = {
  receipt: ReceiptDocument;
  merchant: string;
  flow: ReturnType<typeof resolveSpendOverTimeFlow>;
  currency: string;
  parsedDate: string | undefined;
};

/** A receipt's own page, whatever its source (scan, upload…). */
export const receiptHref = (receipt: Pick<ReceiptDocument, 'id'>): string =>
  `/storage/receipts/${receipt.id}`;

const buildReceiptSpendRecord = ({
  receipt,
  merchant,
  flow,
  currency,
  parsedDate,
}: ReceiptSpendRecordInput): SpendOverTimeRecord => {
  const fa = getFlowAmounts(flow);
  const dateValue = resolveReceiptDateValue(parsedDate, receipt.receivedAt);
  return {
    id: receipt.id,
    source: 'scan',
    receiptSource: receipt.source,
    fileName: merchant,
    subject: receipt.subject,
    sender: receipt.sender,
    status: receipt.status,
    fileType: 'receipt',
    createdAt: receipt.receivedAt,
    statementDateFrom: parsedDate ?? receipt.receivedAt,
    statementDateTo: null,
    bankName: 'receipt',
    totalDebit: fa.totalDebit,
    totalCredit: fa.totalCredit,
    currency,
    exported: null,
    paid: null,
    parsingDetails: null,
    user: null,
    receivedAt: receipt.receivedAt,
    parsedData: { vendor: merchant, date: parsedDate ?? receipt.receivedAt },
    sourceType: 'receipt',
    sourceChannel: 'receipt',
    flowType: flow.flowType,
    amount: flow.amount,
    currencyValue: currency,
    dateValue,
    transactionId: receipt.transactionId ?? null,
    workspaceId: receipt.workspaceId,
    workspaceName: receipt.workspaceName,
    merchant,
    paymentPurpose: merchant,
    href: receiptHref(receipt),
  };
};

export const mapReceiptToSpendRecord = (
  receipt: ReceiptDocument,
  workspaceCurrency: string,
): SpendOverTimeRecord | null => {
  const {
    amount,
    transactionType,
    vendor,
    date: parsedDate,
    currency: parsedCurrency,
  } = extractReceiptParsed(receipt);
  const flow = resolveSpendOverTimeFlow({
    sourceType: 'receipt',
    amount: amount ?? 0,
    transactionType,
  });
  if (flow.amount <= 0) {
    return null;
  }
  const merchant = resolveReceiptMerchantLabel({
    vendor,
    sender: receipt.sender,
    subject: receipt.subject,
    fallback: 'Receipt',
  });
  const currency = resolveCurrencyCode(parsedCurrency, workspaceCurrency);
  return buildReceiptSpendRecord({ receipt, merchant, flow, currency, parsedDate });
};
