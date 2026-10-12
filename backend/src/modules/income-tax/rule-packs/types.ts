/**
 * The contract every country's income-tax form is written against.
 *
 * A pack is pure data plus pure functions: no NestJS, no database. It receives
 * amounts the user has already assigned to its lines and turns them into the
 * figures of one official form. Keeping it that way lets each year's pack be
 * pinned by a plain unit test against the published form.
 *
 * All amounts are whole minor units (see `common/utils/money.util.ts`).
 */

export type TaxpayerType = 'self_employed' | 'employee' | 'company';

export type LineSection = 'income' | 'expense' | 'excluded';

export interface FormLine {
  /** Stable across years, so a user's category mapping survives a new form. */
  key: string;
  section: LineSection;
  /**
   * Printed line and field number on the official form. NULL when the line
   * exists on the form but its number has not been verified against the
   * published form for this year — showing a guessed number would send the
   * user to the wrong box.
   */
  lineNo: string | null;
  fieldNo: string | null;
  /** English description with the official term in parentheses. */
  label: string;
  /**
   * English names of the seeded system categories this line is proposed for.
   * Only ever a proposal: the user confirms every mapping (see StBerG § 2
   * Abs. 3 Nr. 2 — assigning documents to accounts is not ours to decide).
   */
  suggestedFor: string[];
}

/** One transaction's contribution to a line. Negative for refunds. */
export interface LineItem {
  counterparty: string;
  amountMinor: number;
}

export interface PackInput {
  taxYear: number;
  /** Items per line key. Lines nobody mapped to are simply absent. */
  items: Record<string, LineItem[]>;
  /** Free-form profile details, validated by the pack that reads them. */
  details: Record<string, unknown>;
}

export interface Figure {
  key: string;
  lineNo: string | null;
  fieldNo: string | null;
  label: string;
  section: LineSection | 'total' | 'result';
  /** What was booked to the line. */
  amountMinor: number;
  /** What the form accepts after statutory limits. Equal to amount when no limit applies. */
  deductibleMinor: number;
}

export interface PackWarning {
  code: string;
  lineKey?: string;
  params?: Record<string, string | number>;
}

export interface TaxEstimate {
  amountMinor: number;
  /** Plain statement of what the estimate is based on. */
  basis: string;
  /** What the estimate leaves out, shown next to it so it is not read as a bill. */
  excludes: string[];
}

export interface PackResult {
  figures: Figure[];
  warnings: PackWarning[];
  /** NULL when the pack has no verified tariff for the year. */
  taxEstimate: TaxEstimate | null;
}

export interface RulePack {
  /** Year-independent key; mappings are stored against it. */
  formKey: string;
  name: string;
  /** NULL for the generic summary, which serves every country. */
  countryCode: string | null;
  taxpayerTypes: TaxpayerType[];
  /**
   * When one country has several forms for the same taxpayer (Poland: flat
   * rate, lump sum, scale), the regime the profile must name to get this one.
   */
  regime?: string;
  /** Tax years this pack may be used for. Empty means any year. */
  taxYears: number[];
  /**
   * The form edition the line numbers were verified against. When it is older
   * than the tax year, the draft says so rather than implying the numbers are
   * current.
   */
  formEditionYear: number | null;
  /** Where the user files the figures themselves; we never file. */
  filingChannel: string | null;
  lines: FormLine[];
  /**
   * Where the VAT on a VAT-registered business's rows goes. Rows are then
   * counted net and their tax lands on these lines; a pack without them
   * counts rows net and leaves the VAT out, since there it is not income.
   */
  vatLines?: { output: string; input: string };
  compute(input: PackInput): PackResult;
}

export function sumItems(items: LineItem[] | undefined): number {
  return (items ?? []).reduce((total, item) => total + item.amountMinor, 0);
}
