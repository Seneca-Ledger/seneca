import { resolveBankLogo } from '@bank-logos';
import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import type { TopMerchantRecord } from '@/app/(main)/statements/components/top-merchants/top-merchants.types';
import {
  resolveMerchantFlow,
  resolveSourceChannel,
} from '@/app/(main)/statements/components/top-merchants.utils';
import type {
  GmailReceipt,
  StatementMeta,
  Transaction,
} from '@/app/(main)/statements/types/statement-types';
import {
  getTransactionCurrency,
  getTransactionDate,
  mapGmailReceiptToStatement,
  resolveCurrencyCode,
} from '@/app/lib/analytics-common';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';

const opt = (v: string | null | undefined): string | null => (v ? v : null);

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

const getMerchantName = (counterpartyName?: string | null): string => {
  const raw = (counterpartyName ?? '').trim();
  return raw || 'Unknown';
};

const buildTransactionFileType = (meta: StatementMeta | undefined, item: Transaction): string =>
  ((meta?.fileType ?? item.transactionType ?? 'expense') as string).toLowerCase();

// Helpers to extract meta-optional fields with controlled complexity per function:
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

type TransactionRecordInput = {
  item: Transaction;
  meta: StatementMeta | undefined;
  merchant: string;
  amount: number;
  currency: string;
  dateValue: string;
  fileType: string;
  flow: ReturnType<typeof resolveMerchantFlow>;
};

const buildTransactionRecord = ({
  item,
  meta,
  merchant,
  amount,
  currency,
  dateValue,
  fileType,
  flow,
}: TransactionRecordInput): TopMerchantRecord => {
  const ep = getMetaExportedPaid(meta);
  const pu = getMetaParsingUser(meta);
  const ws = getMetaWorkspace(meta, item);
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
    totalDebit: amount,
    totalCredit: null,
    currency,
    exported: ep.exported,
    paid: ep.paid,
    parsingDetails: pu.parsingDetails,
    user: pu.user,
    receivedAt: null,
    parsedData: { vendor: merchant, date: item.transactionDate ?? null },
    merchant,
    amount,
    currencyValue: currency,
    dateValue,
    paymentPurpose: item.paymentPurpose,
    sourceType: 'statement',
    sourceChannel: resolveSourceChannel({
      sourceType: 'statement',
      fileType,
      isCrypto: Boolean(item.cryptoWalletId),
    }),
    flowType: flow.flowType,
    workspaceId: ws.workspaceId,
    workspaceName: ws.workspaceName,
  };
};

export const mapTransactionToRecord = (
  item: Transaction,
  meta: StatementMeta | undefined,
  workspaceCurrency: string,
): TopMerchantRecord => {
  const merchant = getMerchantName(item.counterpartyName);
  const flow = resolveMerchantFlow({
    sourceType: 'statement',
    debit: item.debit,
    credit: item.credit,
    amount: item.amount,
    transactionType: item.transactionType,
  });
  const amount = flow.amount;
  const dateValue = getTransactionDate(item, meta);
  const currency = getTransactionCurrency(item, meta, workspaceCurrency);
  const fileType = buildTransactionFileType(meta, item);
  return buildTransactionRecord({
    item,
    meta,
    merchant,
    amount,
    currency,
    dateValue,
    fileType,
    flow,
  });
};

type ReceiptParsedFields = { vendor?: string; date?: string; currency?: string; amount?: number };
const extractReceiptParsed = (receipt: GmailReceipt): ReceiptParsedFields => ({
  vendor: receipt.parsedData?.vendor,
  date: receipt.parsedData?.date,
  currency: receipt.parsedData?.currency,
  amount: receipt.parsedData?.amount,
});

export const mapGmailReceiptToMerchantRecord = (
  receipt: GmailReceipt,
  workspaceCurrency: string,
): TopMerchantRecord => {
  const mapped = mapGmailReceiptToStatement(receipt, workspaceCurrency);
  const {
    vendor: parsedVendor,
    date: parsedDate,
    currency: parsedCurrency,
    amount: parsedAmount,
  } = extractReceiptParsed(receipt);
  const merchant = resolveGmailMerchantLabel({
    vendor: parsedVendor,
    sender: receipt.sender,
    subject: receipt.subject,
    fallback: mapped.fileName,
  });
  const flow = resolveMerchantFlow({ sourceType: 'gmail', amount: parsedAmount ?? 0 });
  const amount = flow.amount;
  const dateValue = parsedDate ?? receipt.receivedAt ?? '';
  const currency = resolveCurrencyCode(parsedCurrency, workspaceCurrency);
  return {
    ...mapped,
    merchant,
    amount,
    currencyValue: currency,
    dateValue,
    sourceType: 'gmail',
    sourceChannel: mapped.fileType === 'gmail' ? 'gmail' : 'receipt',
    flowType: flow.flowType,
    workspaceId: receipt.workspaceId,
    workspaceName: receipt.workspaceName,
  };
};
