/** Mirrors `backend/src/modules/income-tax/income-tax.types.ts` and the rule-pack types. */

export type TaxpayerType = 'self_employed' | 'employee' | 'company';
export type LineSection = 'income' | 'expense' | 'excluded';

export interface FormLine {
  key: string;
  section: LineSection;
  lineNo: string | null;
  fieldNo: string | null;
  label: string;
  suggestedFor: string[];
}

export interface PackMeta {
  formKey: string;
  name: string;
  countryCode: string | null;
  formEditionYear: number | null;
  filingChannel: string | null;
  isGeneric: boolean;
}

export interface TaxDisclaimerStatus {
  version: string;
  accepted: boolean;
  acceptedAt: string | null;
}

export type DeadlineKind =
  | 'standard'
  | 'paper'
  | 'online'
  | 'adviser'
  | 'online_pay_and_file'
  | 'no_assessment_received'
  | 'direct_debit'
  | 'online_zone_1'
  | 'online_zone_2'
  | 'online_zone_3'
  | 'higher_rate_income'
  | 'with_extension'
  | 'correction';

export type AuthorityPreparation = 'becomes_final' | 'prepared_needs_confirmation' | 'prepared';

export type RetentionKind =
  | 'booking_documents'
  | 'books_and_records'
  | 'other_business_documents'
  | 'tax_records'
  | 'commercial_books'
  | 'accounting_records';

export interface RetentionInfo {
  /** Reference data names the kinds: one this list lacks is shown by its key. */
  periods: Array<{ kind: RetentionKind | (string & {}); years: number | null; until: string }>;
  sourceUrl: string;
}

export interface FilingInfo {
  countryCode: string;
  taxYear: number;
  formName: string;
  filingOpens: string | null;
  /** Reference data names the kinds: one this list lacks is shown by its key. */
  deadlines: Array<{ kind: DeadlineKind | (string & {}); date: string }>;
  authorityPreparation: AuthorityPreparation | null;
  portal: string | null;
  sourceUrl: string;
  /** Optional: drafts finalized before retention was recorded do not carry it. */
  retention?: RetentionInfo | null;
  /**
   * published: the dates the authority announced for the year; statute: worked
   * out from the rule in the law as read on `checkedAt`. Absent on older drafts.
   */
  basis?: 'published' | 'statute';
  checkedAt?: string;
}

export type FxRule = 'transaction_date' | 'nbp_previous_business_day' | 'bdi_reference_rate';

export interface IncomeTaxProfile {
  taxYear: number;
  taxpayerType: TaxpayerType;
  details: Record<string, unknown>;
  country: { code: string; name: string } | null;
  currency: string | null;
  pack: PackMeta | null;
  filingInfo: FilingInfo | null;
}

export type MappingStatus = 'confirmed' | 'suggested' | 'unmapped';

export interface CategoryMapping {
  categoryId: string;
  name: string;
  type: 'income' | 'expense';
  isSystem: boolean;
  transactionCount: number;
  lineKey: string | null;
  status: MappingStatus;
}

export interface MappingsResponse {
  formKey: string;
  lines: FormLine[];
  categories: CategoryMapping[];
}

export interface MappingEntry {
  categoryId: string;
  lineKey: string | null;
}

export type IssueCode =
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

export interface CompletenessIssue {
  code: IssueCode;
  severity: 'info' | 'warning' | 'critical';
  count: number;
  params?: Record<string, unknown>;
}

export interface CompletenessReport {
  score: number;
  issues: CompletenessIssue[];
  activeDaysRatio: number | null;
  daysSinceLastUpload: number | null;
}

export interface DraftFigure {
  key: string;
  lineNo: string | null;
  fieldNo: string | null;
  label: string;
  section: LineSection | 'total' | 'result';
  amount: number;
  deductible: number;
  transactionCount: number;
}

export interface DraftContribution {
  transactionId: string;
  date: string;
  counterparty: string;
  categoryName: string | null;
  currency: string;
  amount: number;
  exchangeRate: number;
  /** Absent on drafts finalized before it was recorded. */
  rateDate?: string;
  amountConverted: number;
}

export interface IncomeTaxDraft {
  taxYear: number;
  status: 'draft' | 'finalized';
  finalizedAt: string | null;
  country: { code: string; name: string };
  currency: string;
  taxpayerType: TaxpayerType;
  details: Record<string, unknown>;
  pack: PackMeta;
  lines: FormLine[];
  figures: DraftFigure[];
  warnings: Array<{ code: string; lineKey?: string; params?: Record<string, unknown> }>;
  taxEstimate: { amount: number; basis: string; excludes: string[] } | null;
  completeness: CompletenessReport;
  disclaimerVersion: string;
  /** Optional: drafts finalized before these were recorded do not carry them. */
  fxRule?: FxRule;
  filingInfo?: FilingInfo | null;
  contributions: Record<string, DraftContribution[]>;
}
