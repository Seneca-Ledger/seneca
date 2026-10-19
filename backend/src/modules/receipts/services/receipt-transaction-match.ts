import { calculateStringSimilarity } from '../../../common/utils/string-similarity.util';

/** What the matcher needs from a receipt. */
export interface ReceiptMatchInput {
  amount: number;
  currency?: string | null;
  /** `YYYY-MM-DD`; without a date nothing is matched. */
  date?: string | null;
  vendor?: string | null;
  transactionType?: 'income' | 'expense' | 'transfer' | 'unknown';
}

/** What the matcher needs from a bank row. */
export interface MatchCandidate {
  id: string;
  transactionDate: Date | string;
  amount: number;
  currency: string;
  counterpartyName: string;
  vendorNormalized?: string | null;
  transactionType: string;
}

export interface ReceiptTransactionMatch {
  /** One id for a plain match, several when one order was charged per shipment. */
  transactionIds: string[];
  kind: 'single' | 'multi';
  /** 0..1 */
  score: number;
}

export interface ScoredCandidate {
  candidate: MatchCandidate;
  score: number;
  daysApart: number;
  vendorSimilarity: number;
}

export const RECEIPT_MATCH_DATE_WINDOW_DAYS = 3;
export const RECEIPT_MULTI_DATE_WINDOW_DAYS = 5;
export const RECEIPT_MATCH_AMOUNT_TOLERANCE = 0.01;
export const RECEIPT_MATCH_MIN_SCORE = 0.6;
/** Two candidates this close in score cannot be told apart; neither is suggested. */
export const RECEIPT_MATCH_MIN_GAP = 0.1;
const MAX_CHARGES_PER_ORDER = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: Date | string, b: Date | string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY_MS;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameCurrency(receipt: ReceiptMatchInput, candidate: MatchCandidate): boolean {
  const wanted = normalize(receipt.currency).toUpperCase();
  return !wanted || wanted === normalize(candidate.currency).toUpperCase();
}

function sameDirection(receipt: ReceiptMatchInput, candidate: MatchCandidate): boolean {
  if (receipt.transactionType === 'income') return candidate.transactionType === 'income';
  if (receipt.transactionType === 'expense') return candidate.transactionType === 'expense';
  return true;
}

function amountsClose(a: number, b: number, tolerance = RECEIPT_MATCH_AMOUNT_TOLERANCE): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 0.01);
  return Math.abs(Math.abs(a) - Math.abs(b)) / scale <= tolerance;
}

export function vendorSimilarity(
  receiptVendor: string | null | undefined,
  candidate: MatchCandidate,
): number {
  const vendor = normalize(receiptVendor);
  if (!vendor) return 0;
  const names = [candidate.counterpartyName, candidate.vendorNormalized]
    .map(normalize)
    .filter(Boolean);
  let best = 0;
  for (const name of names) {
    if (name.includes(vendor) || vendor.includes(name)) return 1;
    best = Math.max(best, calculateStringSimilarity(vendor, name));
  }
  return best;
}

/**
 * Scores every bank row that could be this receipt: same money, same
 * direction, within the date window. The score weighs the amount (it has to
 * match), how close the dates are and how much the names agree.
 */
export function scoreCandidates(
  receipt: ReceiptMatchInput,
  candidates: MatchCandidate[],
  windowDays = RECEIPT_MATCH_DATE_WINDOW_DAYS,
): ScoredCandidate[] {
  if (!(receipt.date && Number.isFinite(receipt.amount)) || receipt.amount <= 0) return [];
  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    if (!(sameCurrency(receipt, candidate) && sameDirection(receipt, candidate))) continue;
    if (!amountsClose(receipt.amount, candidate.amount)) continue;
    const daysApart = daysBetween(receipt.date, candidate.transactionDate);
    if (daysApart > windowDays) continue;
    const similarity = vendorSimilarity(receipt.vendor, candidate);
    const score = 0.5 + 0.3 * (1 - daysApart / windowDays) + 0.2 * similarity;
    scored.push({ candidate, score, daysApart, vendorSimilarity: similarity });
  }
  return scored.sort((a, b) => b.score - a.score || a.daysApart - b.daysApart);
}

/**
 * One order, several charges: Amazon bills per shipment. Looks for a small set
 * of rows from the same payee, close in time, that add up to the receipt.
 * Smallest set first; the first that fits wins.
 */
export function findMultiChargeMatch(
  receipt: ReceiptMatchInput,
  candidates: MatchCandidate[],
): ReceiptTransactionMatch | null {
  if (!(receipt.date && Number.isFinite(receipt.amount)) || receipt.amount <= 0) return null;
  const pool = candidates.filter(
    candidate =>
      sameCurrency(receipt, candidate) &&
      sameDirection(receipt, candidate) &&
      Math.abs(candidate.amount) < receipt.amount &&
      daysBetween(receipt.date as string, candidate.transactionDate) <=
        RECEIPT_MULTI_DATE_WINDOW_DAYS &&
      vendorSimilarity(receipt.vendor, candidate) >= 0.6,
  );
  if (pool.length < 2) return null;

  // Group by payee so two unrelated merchants never get summed together.
  const groups = new Map<string, MatchCandidate[]>();
  for (const candidate of pool) {
    const key = normalize(candidate.vendorNormalized || candidate.counterpartyName);
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  for (let size = 2; size <= MAX_CHARGES_PER_ORDER; size += 1) {
    for (const rows of groups.values()) {
      if (rows.length < size) continue;
      const hit = findSubset(rows, size, receipt.amount);
      if (hit) {
        return { transactionIds: hit.map(row => row.id), kind: 'multi', score: 0.7 };
      }
    }
  }
  return null;
}

function findSubset(rows: MatchCandidate[], size: number, target: number): MatchCandidate[] | null {
  const chosen: MatchCandidate[] = [];
  const walk = (start: number, sum: number): MatchCandidate[] | null => {
    if (chosen.length === size) {
      return amountsClose(sum, target) ? [...chosen] : null;
    }
    for (let i = start; i < rows.length; i += 1) {
      const next = sum + Math.abs(rows[i].amount);
      if (next > target * (1 + RECEIPT_MATCH_AMOUNT_TOLERANCE)) continue;
      chosen.push(rows[i]);
      const found = walk(i + 1, next);
      chosen.pop();
      if (found) return found;
    }
    return null;
  };
  return walk(0, 0);
}

/**
 * The suggestion: the best single row when it is good enough and clearly
 * ahead of the runner-up, else a multi-charge set, else nothing. A wrong
 * attachment hides a real expense behind a receipt, so ties suggest nothing.
 */
export function matchReceiptToTransactions(
  receipt: ReceiptMatchInput,
  candidates: MatchCandidate[],
): ReceiptTransactionMatch | null {
  const scored = scoreCandidates(receipt, candidates);
  const [best, second] = scored;
  if (best && best.score >= RECEIPT_MATCH_MIN_SCORE) {
    if (!second || best.score - second.score >= RECEIPT_MATCH_MIN_GAP) {
      return {
        transactionIds: [best.candidate.id],
        kind: 'single',
        score: Number(best.score.toFixed(2)),
      };
    }
    return null;
  }
  return findMultiChargeMatch(receipt, candidates);
}
