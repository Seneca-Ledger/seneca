import type { FilingInfo } from './filing-info';
import type { FxRule } from './rule-packs/fx-rules';
import type { Figure, FormLine, PackWarning, TaxpayerType } from './rule-packs/types';

/** One transaction's part in a draft, in both its own and the declaration currency. */
export interface DraftContribution {
  transactionId: string;
  date: string;
  counterparty: string;
  categoryName: string | null;
  currency: string;
  /** Signed: negative when it reduces the line (a refund). */
  amount: number;
  exchangeRate: number;
  /** The day the rate belongs to; for NBP the business day before `date`. */
  rateDate: string;
  amountConverted: number;
}

export interface DraftFigure extends Omit<Figure, 'amountMinor' | 'deductibleMinor'> {
  amount: number;
  deductible: number;
  transactionCount: number;
}

export type CompletenessSeverity = 'info' | 'warning' | 'critical';

export interface CompletenessIssue {
  code:
    | 'no_transactions'
    | 'uncategorized_transactions'
    | 'unmapped_categories'
    | 'missing_exchange_rates'
    | 'statement_coverage_gaps'
    | 'statements_with_errors'
    | 'statements_pending_review'
    | 'receipts_pending_review'
    | 'stale_upload'
    | 'irregular_tracking';
  severity: CompletenessSeverity;
  count: number;
  params?: Record<string, unknown>;
}

export interface CompletenessReport {
  /** 0–100. A heuristic of how much of the year the data plausibly covers, not a guarantee. */
  score: number;
  issues: CompletenessIssue[];
  /** Share of elapsed days in the year on which anything was recorded. */
  activeDaysRatio: number | null;
  daysSinceLastUpload: number | null;
}

/** Signals only the draft computation knows, handed to the completeness check. */
export interface DraftSignals {
  transactionCount: number;
  uncategorizedCount: number;
  unmappedTransactionCount: number;
  unmappedCategories: Array<{ categoryId: string; name: string; transactionCount: number }>;
  missingFxCount: number;
  missingFxCurrencies: string[];
}

export interface IncomeTaxDraft {
  taxYear: number;
  status: 'draft' | 'finalized';
  finalizedAt: string | null;
  country: { code: string; name: string };
  currency: string;
  taxpayerType: TaxpayerType;
  details: Record<string, unknown>;
  pack: {
    formKey: string;
    name: string;
    countryCode: string | null;
    formEditionYear: number | null;
    filingChannel: string | null;
    isGeneric: boolean;
  };
  lines: FormLine[];
  figures: DraftFigure[];
  warnings: PackWarning[];
  taxEstimate: { amount: number; basis: string; excludes: string[] } | null;
  completeness: CompletenessReport;
  disclaimerVersion: string;
  fxRule: FxRule;
  /** Verified form, deadlines and portal for the country and year; NULL when not verified. */
  filingInfo: FilingInfo | null;
  contributions: Record<string, DraftContribution[]>;
}
