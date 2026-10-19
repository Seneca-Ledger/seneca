import type { Subscription, SubscriptionFrequency } from '../../entities/subscription.entity';

const CHARGES_PER_YEAR: Record<SubscriptionFrequency, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
} as Record<SubscriptionFrequency, number>;

export const PRICE_CHANGE_THRESHOLD = 0.05;

export interface PriceChange {
  previous: number;
  current: number;
  /** Per charge, signed. */
  delta: number;
  /** Over a year at the subscription's frequency, signed. */
  yearlyDelta: number;
  detectedAt: string;
}

/** The change worth telling the user about, or null when the price moved less than 5%. */
export function describePriceChange(
  previous: number,
  current: number,
  frequency: SubscriptionFrequency,
  now = new Date(),
): PriceChange | null {
  if (!(previous > 0 && current > 0)) return null;
  if (Math.abs(current - previous) / previous <= PRICE_CHANGE_THRESHOLD) return null;
  const delta = Math.round((current - previous) * 100) / 100;
  const perYear = CHARGES_PER_YEAR[frequency] ?? 12;
  return {
    previous,
    current,
    delta,
    yearlyDelta: Math.round(delta * perYear * 100) / 100,
    detectedAt: now.toISOString(),
  };
}

/** Months between two dates, at least one so a brand-new counter does not divide by zero. */
export function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    (to.getDate() - from.getDate()) / 30;
  return Math.max(1, months);
}

export function monthlyCost(amount: number, frequency: SubscriptionFrequency): number {
  switch (frequency) {
    case 'weekly':
      return amount * 4.33;
    case 'quarterly':
      return amount / 3;
    case 'annual':
      return amount / 12;
    default:
      return amount;
  }
}

/** What one use costs: everything paid since the counter started, over the taps. Null until the first tap. */
export function costPerUse(
  sub: Pick<Subscription, 'amount' | 'frequency' | 'usageCount' | 'usageSince'>,
  now = new Date(),
): number | null {
  if (!(sub.usageCount && sub.usageSince)) return null;
  const paid =
    monthlyCost(Number(sub.amount), sub.frequency) * monthsBetween(new Date(sub.usageSince), now);
  return Math.round((paid / sub.usageCount) * 100) / 100;
}

/** Monthly amount to set aside so the next charge is covered by its date. */
export function monthlySetAside(
  amount: number,
  nextChargeDate: Date | string | null,
  now = new Date(),
): number {
  // A `date` column comes back from TypeORM as a string.
  const next = nextChargeDate ? new Date(nextChargeDate) : null;
  const months = next ? Math.max(1, Math.ceil(monthsBetween(now, next))) : 1;
  return Math.round((amount / months) * 100) / 100;
}

const PLAN_WORDS =
  /\b(premium|plus|pro|basic|family|standard|annual|yearly|monthly|plan|subscription|подписка|премиум)\b/giu;

/** Groups rows that look like the same service: by domain when known, else by the name without plan words. */
export function vendorKey(sub: Pick<Subscription, 'vendorName' | 'vendorDomain'>): string {
  if (sub.vendorDomain) return `domain:${sub.vendorDomain.toLowerCase().replace(/^www\./, '')}`;
  const name = (sub.vendorName ?? '')
    .toLowerCase()
    .replace(PLAN_WORDS, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');
  return `name:${name}`;
}

export interface DuplicateGroup<T> {
  key: string;
  items: T[];
}

/** Active or detected rows that share a vendor key: two plans, two cards, two members. */
export function findDuplicateGroups<
  T extends Pick<Subscription, 'vendorName' | 'vendorDomain' | 'status'>,
>(subs: T[]): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const sub of subs) {
    if (sub.status !== 'active' && sub.status !== 'detected') continue;
    const key = vendorKey(sub);
    groups.set(key, [...(groups.get(key) ?? []), sub]);
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({ key, items }));
}
