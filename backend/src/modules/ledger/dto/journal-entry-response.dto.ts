import type {
  JournalEntrySource,
  JournalEntryStatus,
} from '../../../entities/journal-entry.entity';

/** Amounts are decimal strings ("12.30"), exact as stored. */
export interface JournalLineResponseDto {
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  side: 'debit' | 'credit';
  amount: string;
  currency: string;
  baseAmount: string;
  fxRate: string;
  categoryId: string | null;
  branchId: string | null;
}

export interface JournalEntryTotalsDto {
  baseDebit: string;
  baseCredit: string;
  /** Debits minus credits in base currency; posting needs "0.00". */
  difference: string;
}

export interface JournalEntrySummaryDto {
  id: string;
  entryNo: string | null;
  entryDate: string;
  baseCurrency: string;
  memo: string | null;
  status: JournalEntryStatus;
  source: JournalEntrySource;
  reversalOfId: string | null;
  postedAt: Date | null;
  /** Sum of base debits: the size of the entry. */
  baseTotal: string;
}

export interface JournalEntryResponseDto extends Omit<JournalEntrySummaryDto, 'baseTotal'> {
  sourceTransactionId: string | null;
  /** Set on a reversed entry: the entry that cancels it. */
  reversedById: string | null;
  postedBy: string | null;
  createdBy: string | null;
  createdAt: Date;
  lines: JournalLineResponseDto[];
  totals: JournalEntryTotalsDto;
}

export interface PaginatedJournalEntriesDto {
  data: JournalEntrySummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
