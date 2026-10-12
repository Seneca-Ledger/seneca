/** Shapes of the /ledger API. Amounts are decimal strings, exact as the backend stores them. */
import type { JournalEntrySource } from '@/app/lib/contracts';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type Side = 'debit' | 'credit';
export type EntryStatus = 'draft' | 'posted' | 'reversed';
export type EntrySource = JournalEntrySource;

export interface LedgerAccount {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: Side;
  currency: string | null;
  isPostable: boolean;
  isSystem: boolean;
  position: number;
}

export interface LedgerSettings {
  baseCurrency: string | null;
  enabled: boolean;
  suggestedBaseCurrency: string | null;
  pendingTransactions: number;
}

export interface LedgerIntegrity {
  baseCurrency: string | null;
  pendingTransactions: number;
  failingTransactions: number;
  failures: Array<{ transactionId: string; error: string; attemptedAt: string }>;
  orphanEntries: number;
  unbalancedEntries: number;
  cashAccounts: Array<{
    accountId: string;
    code: string;
    name: string;
    currency: string | null;
    ledgerBalance: string;
    statementBalance: string | null;
    statementDate: string | null;
    difference: string | null;
    hasOpeningBalance: boolean;
  }>;
  /** Stale once a foreign-currency movement dated on or before it was booked after it. */
  lastRevaluation: { date: string; entryNo: string | null; stale: boolean } | null;
  upToDate: boolean;
}

export interface JournalEntrySummary {
  id: string;
  entryNo: string | null;
  entryDate: string;
  baseCurrency: string;
  memo: string | null;
  status: EntryStatus;
  source: EntrySource;
  reversalOfId: string | null;
  postedAt: string | null;
  baseTotal: string;
}

export interface JournalLine {
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  side: Side;
  amount: string;
  currency: string;
  baseAmount: string;
  fxRate: string;
  categoryId: string | null;
  branchId: string | null;
}

export interface JournalEntry extends Omit<JournalEntrySummary, 'baseTotal'> {
  sourceTransactionId: string | null;
  reversedById: string | null;
  postedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  lines: JournalLine[];
  totals: { baseDebit: string; baseCredit: string; difference: string };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportFreshness {
  upToDate: boolean;
  pendingTransactions: number;
  failingTransactions: number;
}

export interface TrialBalanceRow {
  accountId: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: AccountType;
  isPostable: boolean;
  openingDebit: string;
  openingCredit: string;
  debit: string;
  credit: string;
  closingDebit: string;
  closingCredit: string;
}

export interface TrialBalance {
  baseCurrency: string;
  dateFrom: string;
  dateTo: string;
  freshness: ReportFreshness;
  rows: TrialBalanceRow[];
  totals: Omit<
    TrialBalanceRow,
    'accountId' | 'parentId' | 'code' | 'name' | 'accountType' | 'isPostable'
  >;
  balanced: boolean;
}

export interface AccountCardLine {
  entryId: string;
  lineNo: number;
  entryNo: string | null;
  entryDate: string;
  memo: string | null;
  source: EntrySource;
  side: Side;
  amount: string;
  currency: string;
  baseAmount: string;
  runningBalance: string;
}

export interface AccountCard {
  baseCurrency: string;
  account: {
    id: string;
    code: string;
    name: string;
    accountType: AccountType;
    normalBalance: Side;
  };
  dateFrom: string;
  dateTo: string;
  freshness: ReportFreshness;
  openingBalance: string;
  closingBalance: string;
  lines: AccountCardLine[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** A line as edited in the entry form, before it is saved. */
export interface DraftLine {
  key: string;
  accountId: string;
  side: Side;
  amount: string;
  currency: string;
}

export interface Revaluation {
  entryId: string;
  entryNo: string | null;
  entryDate: string;
  gain: string;
  loss: string;
}

export type RevaluationResult =
  | { status: 'posted' | 'unchanged'; revaluation: Revaluation }
  | { status: 'nothing_to_revalue'; entryDate: string };
