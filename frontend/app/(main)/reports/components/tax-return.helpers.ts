export interface TaxReturnTotals {
  outputTax: number;
  inputTax: number;
  netPayable: number;
  currency: string;
  lines: TaxReturnLine[];
  /** Rows left out for want of an exchange rate; the period cannot be filed while any remain. */
  missingRates?: Array<{ transactionId: string; date: string; currency: string }>;
}

export interface TaxReturnLine {
  transactionId: string;
  date: string;
  counterparty: string;
  direction: 'output' | 'input' | 'reverse_charge';
  currency: string;
  taxAmount: number;
  netAmount: number;
  exchangeRate: number;
  taxAmountConverted: number;
}

export interface TaxReturnRecord {
  id: string;
  status: 'draft' | 'filed';
  periodStart: string;
  periodEnd: string;
  outputTax: string | number;
  inputTax: string | number;
  netPayable: string | number;
  currency: string;
  filedAt: string | null;
}

export interface ThresholdStatus {
  threshold: number | null;
  turnover: number;
  currency: string;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
  /** Currencies of sales left out for want of an exchange rate. */
  missingRateCurrencies?: string[];
}

const pad = (value: number) => `${value}`.padStart(2, '0');

/** Local calendar day as 'YYYY-MM-DD', which is what the API compares against. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear';

/**
 * Quarters are built from month arithmetic rather than day counts, so the
 * boundaries land right in leap years and across December.
 */
export function periodFor(
  preset: PeriodPreset,
  now: Date = new Date(),
): {
  periodStart: string;
  periodEnd: string;
} {
  const year = now.getFullYear();

  if (preset === 'thisYear') {
    return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` };
  }

  if (preset === 'thisMonth' || preset === 'lastMonth') {
    const start = new Date(year, now.getMonth() + (preset === 'lastMonth' ? -1 : 0), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { periodStart: toDateInput(start), periodEnd: toDateInput(end) };
  }

  const quarter = Math.floor(now.getMonth() / 3);
  const offset = preset === 'lastQuarter' ? -1 : 0;
  // Day 0 of the month after the quarter is the quarter's last day, which
  // handles February and the year rollover without a special case.
  const start = new Date(year, (quarter + offset) * 3, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);

  return { periodStart: toDateInput(start), periodEnd: toDateInput(end) };
}

export function formatMoney(value: string | number, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '—';
  }
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

/**
 * A positive net is owed to the tax authority, a negative one is reclaimable.
 * Showing a bare signed number leaves the reader to work that out.
 */
export function netDirection(netPayable: string | number): 'payable' | 'refund' | 'zero' {
  const amount = Number(netPayable);
  if (!Number.isFinite(amount) || amount === 0) {
    return 'zero';
  }
  return amount > 0 ? 'payable' : 'refund';
}

/**
 * Hands a downloaded blob to the browser.
 *
 * The export endpoint needs the workspace header and the bearer token, so it
 * cannot be a plain anchor href — the file arrives through the API client and
 * is handed over here.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Without this the blob stays in memory for the life of the document.
  URL.revokeObjectURL(url);
}

export function exportFileName(
  periodStart: string,
  periodEnd: string,
  format: 'pdf' | 'xlsx' | 'csv',
): string {
  return `tax-return-${periodStart}_${periodEnd}.${format}`;
}

export interface TaxDeadline {
  kind: 'vat_return' | 'income_tax';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  daysLeft: number;
  done: boolean;
  filedElsewhere: boolean;
  returnName: string;
  /** statute: worked out from the rule in the law; published: announced for the year. */
  basis?: 'statute' | 'published';
  /** When that rule or announcement was last read. */
  checkedAt?: string;
}

export interface VatFiling {
  frequency: 'monthly' | 'quarterly' | 'annual' | null;
  isDefault: boolean;
  extension: boolean;
  extensionName: string | null;
  deadlinesKnown: boolean;
  knownFrequencies: Array<'monthly' | 'quarterly' | 'annual'>;
}
