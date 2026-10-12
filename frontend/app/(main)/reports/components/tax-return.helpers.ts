import type {
  TaxDeadline,
  TaxReturnLine,
  TaxReturnPreview,
  TaxReturnRecord,
  TaxThresholdStatus,
  VatFilingSettings,
} from '@/app/lib/contracts';

export type { TaxDeadline, TaxReturnLine, TaxReturnRecord };
/** `GET /tax/returns/preview`: the period computed live. */
export type TaxReturnTotals = TaxReturnPreview;
export type ThresholdStatus = NonNullable<TaxThresholdStatus>;
export type VatFiling = VatFilingSettings;

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
