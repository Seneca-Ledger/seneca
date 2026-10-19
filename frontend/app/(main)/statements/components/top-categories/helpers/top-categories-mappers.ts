import { resolveBankLogo } from '@bank-logos';
import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import type {
  TopCategoryRecord,
  TopCategorySourceChannel,
} from '@/app/(main)/statements/components/top-categories.utils';
import {
  resolveCategoryFlow,
  resolveCategoryName,
  resolveCategorySourceChannel,
} from '@/app/(main)/statements/components/top-categories.utils';
import type {
  GmailReceipt,
  StatementMeta,
  Transaction,
} from '@/app/(main)/statements/types/statement-types';
import {
  getTransactionCurrency,
  getTransactionDate,
  resolveCurrencyCode,
} from '@/app/lib/analytics-common';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';

export const getBankDisplayName = (bankName?: string | null): string => {
  const raw = (bankName ?? '').trim();
  if (!raw) {
    return 'Unknown';
  }
  if (raw.toLowerCase() === 'gmail') {
    return 'Gmail';
  }
  const resolved = resolveBankLogo(raw);
  if (!resolved) {
    return raw;
  }
  return resolved.key !== 'other' ? resolved.displayName : raw;
};

// Meta field helpers to keep complexity per function ≤ 6:
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

const buildCategoryFileType = (meta: StatementMeta | undefined, item: Transaction): string =>
  ((meta?.fileType ?? item.transactionType ?? 'expense') as string).toLowerCase();

type CategoryParsedData = { vendor: string | null | undefined; date: string | null | undefined };
const buildTransactionParsedData = (
  item: Transaction,
  categoryName: string,
): CategoryParsedData => ({
  vendor: item.counterpartyName ?? categoryName,
  date: item.transactionDate ?? null,
});

type ItemColorIcon = { color: string | null; icon: string | null };
const getItemColorIcon = (item: Transaction): ItemColorIcon => ({
  color: item.category?.color ?? null,
  icon: item.category?.icon ?? null,
});

type TxRecordInput = {
  item: Transaction;
  meta: StatementMeta | undefined;
  categoryName: string;
  amount: number;
  currency: string;
  dateValue: string;
  fileType: string;
  flow: ReturnType<typeof resolveCategoryFlow>;
};

const buildTransactionCategoryRecord = ({
  item,
  meta,
  categoryName,
  amount,
  currency,
  dateValue,
  fileType,
  flow,
}: TxRecordInput): TopCategoryRecord => {
  const ep = getMetaExportedPaid(meta);
  const pu = getMetaParsingUser(meta);
  const ws = getMetaWorkspace(meta, item);
  const ci = getItemColorIcon(item);
  const ch = resolveCategorySourceChannel({
    sourceType: 'statement',
    fileType,
    isCrypto: Boolean(item.cryptoWalletId),
  });
  return {
    id: item.id,
    source: 'statement',
    fileName: categoryName,
    subject: null,
    sender: null,
    status: getMetaStatus(meta),
    fileType,
    createdAt: getMetaCreatedAt(meta, item),
    statementDateFrom: getMetaDateFrom(meta, item),
    statementDateTo: getMetaDateTo(meta),
    bankName: getMetaBankName(meta),
    totalDebit: amount,
    totalCredit: null,
    currency,
    exported: ep.exported,
    paid: ep.paid,
    parsingDetails: pu.parsingDetails,
    user: pu.user,
    receivedAt: null,
    parsedData: buildTransactionParsedData(item, categoryName),
    category: categoryName,
    amount,
    currencyValue: currency,
    dateValue,
    sourceType: 'statement',
    sourceChannel: ch as TopCategorySourceChannel,
    flowType: flow.flowType,
    transactionId: item.id,
    color: ci.color,
    icon: ci.icon,
    workspaceId: ws.workspaceId,
    workspaceName: ws.workspaceName,
    paymentPurpose: item.paymentPurpose,
    counterpartyName: item.counterpartyName,
  };
};

export const mapTransactionToCategoryRecord = (
  item: Transaction,
  meta: StatementMeta | undefined,
  workspaceCurrency: string,
): TopCategoryRecord | null => {
  const categoryName = resolveCategoryName(item.category?.name);
  const flow = resolveCategoryFlow({
    sourceType: 'statement',
    debit: item.debit,
    credit: item.credit,
    amount: item.amount,
    transactionType: item.transactionType,
  });
  if (flow.amount <= 0) {
    return null;
  }
  const amount = flow.amount;
  const dateValue = getTransactionDate(item, meta);
  const currency = getTransactionCurrency(item, meta, workspaceCurrency);
  const fileType = buildCategoryFileType(meta, item);
  return buildTransactionCategoryRecord({
    item,
    meta,
    categoryName,
    amount,
    currency,
    dateValue,
    fileType,
    flow,
  });
};

type ReceiptParsedBase = { vendor?: string; date?: string; currency?: string; amount?: number };
const extractReceiptParsedBase = (receipt: GmailReceipt): ReceiptParsedBase => ({
  vendor: receipt.parsedData?.vendor,
  date: receipt.parsedData?.date,
  currency: receipt.parsedData?.currency,
  amount: receipt.parsedData?.amount,
});

type ReceiptParsedCategory = {
  category?: string;
  categoryId?: string;
  transactionId?: string | null;
  transactionType?: string;
};
const extractReceiptParsedCategory = (receipt: GmailReceipt): ReceiptParsedCategory => ({
  category: receipt.parsedData?.category as string | undefined,
  categoryId: receipt.parsedData?.categoryId as string | undefined,
  transactionId: receipt.transactionId,
  transactionType: receipt.parsedData?.transactionType as string | undefined,
});

const resolveParsedCategoryName = (category?: string, categoryId?: string): string =>
  resolveCategoryName(category ?? categoryId ?? null);

const resolveReceiptDateValue = (parsedDate?: string, receivedAt?: string | null): string =>
  parsedDate ?? receivedAt ?? '';

type GmailCategoryRecordInput = {
  receipt: GmailReceipt;
  categoryName: string;
  amount: number;
  merchant: string;
  parsedDate: string | undefined;
  currency: string;
  ch: TopCategorySourceChannel;
  flow: ReturnType<typeof resolveCategoryFlow>;
  parsedTransactionId: string | null | undefined;
};

const buildGmailCategoryRecord = ({
  receipt,
  categoryName,
  amount,
  merchant,
  parsedDate,
  currency,
  ch,
  flow,
  parsedTransactionId,
}: GmailCategoryRecordInput): TopCategoryRecord => ({
  id: receipt.id,
  source: 'gmail',
  fileName: categoryName,
  subject: receipt.subject,
  sender: receipt.sender,
  status: receipt.status,
  fileType: ch === 'gmail' ? 'gmail' : 'receipt',
  createdAt: receipt.receivedAt,
  statementDateFrom: parsedDate ?? receipt.receivedAt,
  statementDateTo: null,
  bankName: ch === 'gmail' ? 'gmail' : 'receipt',
  totalDebit: amount,
  totalCredit: null,
  currency,
  exported: null,
  paid: null,
  parsingDetails: null,
  user: null,
  receivedAt: receipt.receivedAt,
  parsedData: { vendor: merchant, date: parsedDate ?? receipt.receivedAt },
  category: categoryName,
  amount,
  currencyValue: currency,
  dateValue: resolveReceiptDateValue(parsedDate, receipt.receivedAt),
  sourceType: 'gmail',
  sourceChannel: ch as TopCategorySourceChannel,
  flowType: flow.flowType,
  transactionId: parsedTransactionId ?? null,
  color: null,
  icon: null,
  workspaceId: receipt.workspaceId,
  workspaceName: receipt.workspaceName,
  paymentPurpose: merchant,
  counterpartyName: merchant,
});

export const mapGmailReceiptToCategoryRecord = (
  receipt: GmailReceipt,
  workspaceCurrency: string,
): TopCategoryRecord | null => {
  const {
    vendor,
    date: parsedDate,
    currency: parsedCurrency,
    amount: parsedAmount,
  } = extractReceiptParsedBase(receipt);
  const { category, categoryId, transactionId, transactionType } =
    extractReceiptParsedCategory(receipt);
  const categoryName = resolveParsedCategoryName(category, categoryId);
  const flow = resolveCategoryFlow({
    sourceType: 'gmail',
    amount: parsedAmount ?? 0,
    transactionType: transactionType as 'income' | 'expense' | null,
  });
  if (flow.amount <= 0) {
    return null;
  }
  const amount = flow.amount;
  const merchant = resolveGmailMerchantLabel({
    vendor,
    sender: receipt.sender,
    subject: receipt.subject,
    fallback: categoryName,
  });
  const currency = resolveCurrencyCode(parsedCurrency, workspaceCurrency);
  const isLocalReceipt = !!receipt.source && receipt.source !== 'gmail';
  const ch: TopCategorySourceChannel = isLocalReceipt ? 'receipt' : 'gmail';
  return buildGmailCategoryRecord({
    receipt,
    categoryName,
    amount,
    merchant,
    parsedDate,
    currency,
    ch: ch as TopCategorySourceChannel,
    flow,
    parsedTransactionId: transactionId,
  });
};
