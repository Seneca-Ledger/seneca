import { Between, type FindOperator, type Repository } from 'typeorm';
import type { SubscriptionMonthStatus } from '../../contracts';
import type { SubscriptionCharge } from '../../entities/subscription-charge.entity';
import { CurrencyTotals } from './currency-totals';

/** Turns an amount into the workspace currency at the rate of a given day. */
export type ConvertAt = (amount: number, currency: string, day: Date) => Promise<number>;

const monthKey = (day: Date): string =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`;

const localDay = (day: Date): string =>
  `${monthKey(day)}-${String(day.getDate()).padStart(2, '0')}`;

/** The days of a month as a `date` column filter, first to last. */
const monthDays = (year: number, monthNumber: number): FindOperator<Date> =>
  Between(
    localDay(new Date(year, monthNumber - 1, 1)),
    localDay(new Date(year, monthNumber, 0)),
  ) as unknown as FindOperator<Date>;

/** `month` (`YYYY-MM`) is over: it is before the month `today` is in. */
export function isPastMonth(month: string | undefined, today: Date): month is string {
  return month !== undefined && month < monthKey(today);
}

/** Today, or the first day of `month` (`YYYY-MM`) when that month is still ahead. */
export function dayInMonth(month: string | undefined, today: Date): Date {
  if (!month || month <= monthKey(today)) return today;
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1);
}

/** How many payments each subscription of the workspace has recorded in the month of `day`. */
export async function chargesInMonth(
  charges: Repository<SubscriptionCharge>,
  workspaceId: string,
  day: Date,
): Promise<Map<string, number>> {
  const rows = await charges.find({
    select: { subscriptionId: true },
    where: { workspaceId, chargeDate: monthDays(day.getFullYear(), day.getMonth() + 1) },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.subscriptionId, (counts.get(row.subscriptionId) ?? 0) + 1);
  }
  return counts;
}

/**
 * A month that is over, told by what was charged in it: the subscriptions that
 * charged then, cancelled ones included, at the amounts that went out. One that
 * did not exist yet, or charged nothing, is not in it; nothing is left to come.
 */
export async function pastMonthStatus(
  charges: Repository<SubscriptionCharge>,
  convert: ConvertAt,
  workspaceId: string,
  month: string,
  currency: string | null,
): Promise<SubscriptionMonthStatus> {
  const [year, monthNumber] = month.split('-').map(Number);
  const rows = await charges.find({
    where: { workspaceId, chargeDate: monthDays(year, monthNumber) },
    relations: { subscription: true },
    order: { chargeDate: 'ASC' },
  });

  const paidByCurrency = new CurrencyTotals();
  const bySubscription = new Map<string, SubscriptionMonthStatus['items'][number]>();
  let paidAmount = 0;
  for (const charge of rows) {
    // A `date` column comes back as `YYYY-MM-DD`; read as a local day, not UTC midnight.
    const dayText =
      charge.chargeDate instanceof Date
        ? localDay(charge.chargeDate)
        : String(charge.chargeDate).slice(0, 10);
    const day = new Date(`${dayText}T00:00:00`);
    const amount = Number(charge.amount);
    paidByCurrency.add(charge.currency, amount);
    const converted =
      currency && charge.currency.toUpperCase() !== currency
        ? await convert(amount, charge.currency, day)
        : amount;
    paidAmount += converted;
    const item = bySubscription.get(charge.subscriptionId);
    bySubscription.set(charge.subscriptionId, {
      subscriptionId: charge.subscriptionId,
      vendorName: charge.subscription.vendorName,
      vendorDomain: charge.subscription.vendorDomain ?? null,
      amount: Math.round(((item?.amount ?? 0) + converted) * 100) / 100,
      paid: true,
      nextChargeDate: dayText,
    });
  }

  return {
    currency,
    month,
    paidAmount: Math.round(paidAmount * 100) / 100,
    paidCount: rows.length,
    unpaidAmount: 0,
    unpaidCount: 0,
    paidByCurrency: paidByCurrency.list(),
    unpaidByCurrency: [],
    items: [...bySubscription.values()],
  };
}
