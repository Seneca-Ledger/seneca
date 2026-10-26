/**
 * Bank rows against open bills and receivables, ageing buckets and duplicate
 * bills — pure functions over already-loaded rows, so the rules can be read
 * and tested without a database.
 */

export interface OpenItem {
  id: string;
  direction: 'payable' | 'receivable';
  vendor: string;
  amount: number;
  currency: string;
  /** YYYY-MM-DD or null */
  dueDate: string | null;
  createdAt: string;
  status: string;
  /** Converted to the workspace currency. */
  amountInWorkspace: number;
}

export interface BankRow {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: string;
  counterpartyName: string | null;
  paymentPurpose: string | null;
}

export interface ReconciliationMatch {
  itemId: string;
  transactionId: string;
  /** 0–1: amount and currency are required; the rest adds confidence. */
  confidence: number;
  reasons: Array<'amount' | 'vendor' | 'date'>;
}

const DATE_WINDOW_DAYS = 14;
/**
 * A row only counts as the payment of a bill when it lands between three weeks
 * before and about six weeks after the due date. Wider, and a monthly bill
 * would be offered last month's (or last quarter's) payment of the same amount.
 */
const PAID_EARLY_MAX_DAYS = 21;
const PAID_LATE_MAX_DAYS = 45;

/**
 * One bank row per open item, best confidence first: the amount must match to
 * the cent in the same currency, the direction must agree and the row must
 * fall in the payment window around the due date; a vendor name
 * found in the row's text and a date near the due date raise the confidence.
 */
export function matchOpenItems(items: OpenItem[], rows: BankRow[]): ReconciliationMatch[] {
  const candidates: ReconciliationMatch[] = [];
  for (const item of items) {
    const wanted = item.direction === 'receivable' ? 'income' : 'expense';
    const vendor = normalize(item.vendor);
    const anchor = item.dueDate ?? item.createdAt.slice(0, 10);
    for (const row of rows) {
      if (row.type !== wanted) continue;
      if (row.currency.toUpperCase() !== item.currency.toUpperCase()) continue;
      if (Math.abs(Math.abs(row.amount) - Math.abs(item.amount)) > 0.01) continue;
      const offset = daysBetween(anchor, row.date);
      if (offset < -PAID_EARLY_MAX_DAYS || offset > PAID_LATE_MAX_DAYS) continue;
      const reasons: ReconciliationMatch['reasons'] = ['amount'];
      let confidence = 0.5;
      const haystack = normalize(`${row.counterpartyName ?? ''} ${row.paymentPurpose ?? ''}`);
      if (vendor && haystack.includes(vendor)) {
        reasons.push('vendor');
        confidence += 0.3;
      }
      const distance = Math.abs(offset);
      if (distance <= DATE_WINDOW_DAYS) {
        reasons.push('date');
        confidence += 0.2 * (1 - distance / (DATE_WINDOW_DAYS + 1));
      }
      candidates.push({
        itemId: item.id,
        transactionId: row.id,
        confidence: Math.round(confidence * 100) / 100,
        reasons,
      });
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  const usedItems = new Set<string>();
  const usedRows = new Set<string>();
  const matches: ReconciliationMatch[] = [];
  for (const candidate of candidates) {
    if (usedItems.has(candidate.itemId) || usedRows.has(candidate.transactionId)) continue;
    usedItems.add(candidate.itemId);
    usedRows.add(candidate.transactionId);
    matches.push(candidate);
  }
  return matches;
}

export type AgeingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';
export const AGEING_BUCKETS: AgeingBucket[] = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'];

export interface AgeingRow {
  direction: 'payable' | 'receivable';
  buckets: Record<AgeingBucket, number>;
  total: number;
  /** Largest counterparties by open amount, with their worst bucket. */
  top: Array<{ vendor: string; amount: number; bucket: AgeingBucket }>;
}

export function bucketFor(dueDate: string | null, today: string): AgeingBucket {
  if (!dueDate) return 'current';
  const overdue = daysBetween(dueDate, today);
  if (overdue <= 0) return 'current';
  if (overdue <= 30) return 'd1_30';
  if (overdue <= 60) return 'd31_60';
  if (overdue <= 90) return 'd61_90';
  return 'd90_plus';
}

/** Open amounts by how long past due, for each direction. */
export function ageing(items: OpenItem[], today: string, topN = 5): AgeingRow[] {
  return (['payable', 'receivable'] as const).map(direction => {
    const buckets: Record<AgeingBucket, number> = {
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90_plus: 0,
    };
    const byVendor = new Map<string, { amount: number; bucket: AgeingBucket }>();
    for (const item of items) {
      if (item.direction !== direction) continue;
      const bucket = bucketFor(item.dueDate, today);
      buckets[bucket] = round(buckets[bucket] + item.amountInWorkspace);
      const current = byVendor.get(item.vendor) ?? { amount: 0, bucket: 'current' as AgeingBucket };
      byVendor.set(item.vendor, {
        amount: round(current.amount + item.amountInWorkspace),
        bucket:
          AGEING_BUCKETS.indexOf(bucket) > AGEING_BUCKETS.indexOf(current.bucket)
            ? bucket
            : current.bucket,
      });
    }
    const total = round(Object.values(buckets).reduce((sum, value) => sum + value, 0));
    const top = [...byVendor.entries()]
      .map(([vendor, value]) => ({ vendor, ...value }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, topN);
    return { direction, buckets, total, top };
  });
}

export interface DuplicateGroup {
  vendor: string;
  amount: number;
  currency: string;
  itemIds: string[];
}

/** Open bills with the same counterparty, the same amount and due dates within a week. */
export function findDuplicateOpenItems(items: OpenItem[], windowDays = 7): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const sorted = [...items].sort((a, b) =>
    (a.dueDate ?? a.createdAt).localeCompare(b.dueDate ?? b.createdAt),
  );
  const used = new Set<string>();
  for (let i = 0; i < sorted.length; i += 1) {
    const base = sorted[i];
    if (used.has(base.id)) continue;
    const group: DuplicateGroup = {
      vendor: base.vendor,
      amount: base.amount,
      currency: base.currency,
      itemIds: [base.id],
    };
    for (let j = i + 1; j < sorted.length; j += 1) {
      const other = sorted[j];
      if (used.has(other.id) || other.direction !== base.direction) continue;
      if (normalize(other.vendor) !== normalize(base.vendor)) continue;
      if (other.currency.toUpperCase() !== base.currency.toUpperCase()) continue;
      if (Math.abs(Number(other.amount) - Number(base.amount)) > 0.01) continue;
      const a = base.dueDate ?? base.createdAt.slice(0, 10);
      const b = other.dueDate ?? other.createdAt.slice(0, 10);
      if (Math.abs(daysBetween(a, b)) > windowDays) continue;
      group.itemIds.push(other.id);
    }
    if (group.itemIds.length > 1) {
      for (const id of group.itemIds) used.add(id);
      groups.push(group);
    }
  }
  return groups;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = to.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
