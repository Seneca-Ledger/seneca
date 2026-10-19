import { resolveBankLogo } from '@bank-logos';
import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import {
  resolveSourceChannel,
  resolveSpenderFlow,
  type TopSpenderFlowType,
  type TopSpenderRecord,
  type TopSpenderSourceChannel,
} from '@/app/(main)/statements/components/top-spenders/top-spenders.types';
import type { GmailReceipt } from '@/app/(main)/statements/types/statement-types';
import { resolveCurrencyCode } from '@/app/lib/analytics-common';
import { resolveGmailMerchantLabel } from '@/app/lib/gmail-merchant';

/** Collapse an optional string to null rather than empty string. */
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

const getGmailDate = (s: StatementFilterItem): string =>
  s.parsedData?.date ?? s.receivedAt ?? s.createdAt ?? '';

const getStatDate = (s: StatementFilterItem): string =>
  s.statementDateTo ?? s.statementDateFrom ?? s.createdAt ?? '';

const getStatementDate = (s: StatementFilterItem): string =>
  s.source === 'gmail' ? getGmailDate(s) : getStatDate(s);

const extractMetaCurrency = (
  meta: Record<string, unknown> | null | undefined,
): string | undefined =>
  (meta?.currency as string | undefined) ??
  (meta?.headerDisplay as Record<string, string> | undefined)?.currencyDisplay;

const extractParsedCurrency = (
  details: StatementFilterItem['parsingDetails'],
): string | undefined =>
  extractMetaCurrency(details?.metadataExtracted as Record<string, unknown> | undefined);

const getStatementCurrency = (s: StatementFilterItem, fb: string): string =>
  s.currency ?? extractParsedCurrency(s.parsingDetails) ?? fb;

type StatementWithWorkspace = StatementFilterItem & {
  workspaceId?: string;
  workspaceName?: string;
};

const resolveGmailCompany = (item: StatementFilterItem): string =>
  resolveGmailMerchantLabel({
    vendor: item.parsedData?.vendor ?? undefined,
    sender: item.sender ?? undefined,
    subject: item.subject ?? undefined,
    fallback: item.fileName,
  });

type ParsedDataInput = {
  item: StatementFilterItem;
  company: string;
  sourceType: string;
  dateValue: string;
};
const buildStatementParsedData = ({
  item,
  company,
  sourceType,
  dateValue,
}: ParsedDataInput): { vendor: string | null; date: string } => ({
  vendor: item.parsedData?.vendor ?? (sourceType === 'gmail' ? company : null),
  date: item.parsedData?.date ?? dateValue,
});

type StatementRecordInput = {
  item: StatementWithWorkspace;
  company: string;
  amount: number;
  currency: string;
  dateValue: string;
  sourceType: 'statement' | 'gmail';
  fileType: string | null;
  flow: ReturnType<typeof resolveSpenderFlow>;
};

const buildStatementRecord = ({
  item,
  company,
  amount,
  currency,
  dateValue,
  sourceType,
  fileType,
  flow,
}: StatementRecordInput): TopSpenderRecord => ({
  id: item.id,
  source: sourceType,
  fileName: company,
  subject: opt(item.subject),
  sender: opt(item.sender),
  status: opt(item.status),
  fileType,
  createdAt: opt(item.createdAt),
  statementDateFrom: opt(item.statementDateFrom),
  statementDateTo: opt(item.statementDateTo),
  bankName: opt(item.bankName),
  totalDebit: amount,
  totalCredit: null,
  currency,
  exported: item.exported ?? null,
  paid: item.paid ?? null,
  parsingDetails: item.parsingDetails ?? null,
  user: item.user ?? null,
  receivedAt: opt(item.receivedAt),
  parsedData: buildStatementParsedData({ item, company, sourceType, dateValue }),
  company,
  amount,
  currencyValue: currency,
  dateValue,
  sourceType,
  sourceChannel: resolveSourceChannel({ sourceType, fileType }) as TopSpenderSourceChannel,
  flowType: flow.flowType as TopSpenderFlowType,
  workspaceId: item.workspaceId,
  workspaceName: item.workspaceName,
});

export const mapStatementToRecord = (
  item: StatementWithWorkspace,
  workspaceCurrency: string,
): TopSpenderRecord => {
  const sourceType: 'statement' | 'gmail' = item.source === 'gmail' ? 'gmail' : 'statement';
  const company =
    sourceType === 'gmail' ? resolveGmailCompany(item) : getBankDisplayName(item.bankName);
  const dateValue = getStatementDate(item);
  const flow = resolveSpenderFlow({
    sourceType,
    totalDebit: item.totalDebit,
    totalCredit: item.totalCredit,
  });
  const currency = getStatementCurrency(item, workspaceCurrency);
  const fileType = (item.fileType ?? '').toLowerCase() || null;
  return buildStatementRecord({
    item,
    company,
    amount: flow.amount,
    currency,
    dateValue,
    sourceType,
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

type ReceiptRecordInput = {
  receipt: GmailReceipt;
  company: string;
  currency: string;
  flow: ReturnType<typeof resolveSpenderFlow>;
  receivedAt: string | null;
  parsedVendor?: string;
  parsedDate?: string;
  dateValue: string;
};

const buildReceiptRecord = ({
  receipt,
  company,
  currency,
  flow,
  receivedAt,
  parsedVendor,
  parsedDate,
  dateValue,
}: ReceiptRecordInput): TopSpenderRecord => {
  const isLocalReceipt = !!receipt.source && receipt.source !== 'gmail';
  return {
    id: receipt.id,
    source: 'gmail',
    fileName: company,
    subject: opt(receipt.subject),
    sender: opt(receipt.sender),
    status: opt(receipt.status),
    fileType: isLocalReceipt ? 'receipt' : 'gmail',
    createdAt: receivedAt,
    statementDateFrom: parsedDate ?? receivedAt,
    statementDateTo: null,
    bankName: isLocalReceipt ? 'receipt' : 'gmail',
    totalDebit: flow.amount,
    totalCredit: null,
    currency,
    exported: null,
    paid: null,
    parsingDetails: null,
    user: null,
    receivedAt,
    parsedData: { vendor: parsedVendor ?? company, date: parsedDate ?? receivedAt },
    company,
    amount: flow.amount,
    currencyValue: currency,
    dateValue,
    sourceType: 'gmail',
    sourceChannel: (isLocalReceipt ? 'receipt' : 'gmail') as TopSpenderSourceChannel,
    flowType: flow.flowType as TopSpenderFlowType,
    workspaceId: receipt.workspaceId,
    workspaceName: receipt.workspaceName,
  };
};

export const mapReceiptToRecord = (
  receipt: GmailReceipt,
  workspaceCurrency: string,
): TopSpenderRecord => {
  const {
    vendor: parsedVendor,
    date: parsedDate,
    currency: parsedCurrency,
    amount: parsedAmount,
  } = extractReceiptParsed(receipt);
  const company = resolveGmailMerchantLabel({
    vendor: parsedVendor,
    sender: receipt.sender,
    subject: receipt.subject,
    fallback: 'Gmail receipt',
  });
  const currency = resolveCurrencyCode(parsedCurrency, workspaceCurrency);
  const flow = resolveSpenderFlow({ sourceType: 'gmail', totalDebit: parsedAmount });
  const receivedAt = opt(receipt.receivedAt);
  const dateValue = parsedDate ?? receivedAt ?? '';
  return buildReceiptRecord({
    receipt,
    company,
    currency,
    flow,
    receivedAt,
    parsedVendor,
    parsedDate,
    dateValue,
  });
};
