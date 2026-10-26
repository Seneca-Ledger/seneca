import { SubscriptionFrequency } from '@/entities/subscription.entity';
import {
  chargeAt,
  countChargesBetween,
  projectMonthlyCharges,
  splitMonthCharges,
} from '@/modules/subscriptions/charge-calendar.util';

const FROM = new Date(2026, 0, 15); // 15 Jan 2026

describe('projectMonthlyCharges', () => {
  it('caps the horizon at ten years however many months are asked for', () => {
    const buckets = projectMonthlyCharges(
      new Date(2026, 0, 20),
      SubscriptionFrequency.MONTHLY,
      FROM,
      1_000_000,
    );
    expect(buckets).toHaveLength(120);
  });

  it('fills every bucket for a monthly subscription', () => {
    const buckets = projectMonthlyCharges(
      new Date(2026, 0, 20),
      SubscriptionFrequency.MONTHLY,
      FROM,
      6,
    );
    expect(buckets).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('puts an annual subscription in exactly one month', () => {
    const buckets = projectMonthlyCharges(
      new Date(2026, 2, 3),
      SubscriptionFrequency.ANNUAL,
      FROM,
      6,
    );
    expect(buckets).toEqual([0, 0, 1, 0, 0, 0]);
  });

  it('puts a quarterly subscription three months apart', () => {
    const buckets = projectMonthlyCharges(
      new Date(2026, 0, 20),
      SubscriptionFrequency.QUARTERLY,
      FROM,
      6,
    );
    expect(buckets).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('counts weekly charges per calendar month rather than a 4.33 average', () => {
    // 1 Mar 2026 is a Sunday: March has charges on 1, 8, 15, 22, 29 and
    // April on 5, 12, 19, 26.
    const buckets = projectMonthlyCharges(
      new Date(2026, 2, 1),
      SubscriptionFrequency.WEEKLY,
      new Date(2026, 2, 1),
      2,
    );
    expect(buckets).toEqual([5, 4]);
  });

  it('charges in February for a subscription billed on the 31st', () => {
    // Stepping with Date.setMonth would yield Mar 3 and skip February.
    const buckets = projectMonthlyCharges(
      new Date(2026, 0, 31),
      SubscriptionFrequency.MONTHLY,
      new Date(2026, 0, 1),
      3,
    );
    expect(buckets).toEqual([1, 1, 1]);
  });

  it('rolls a stale charge date forward to the first occurrence in range', () => {
    // Six months before `from`, as if the daily cron had not run.
    const buckets = projectMonthlyCharges(
      new Date(2025, 6, 10),
      SubscriptionFrequency.MONTHLY,
      FROM,
      3,
    );
    expect(buckets).toEqual([1, 1, 1]);
  });

  it('returns zeros when there is no charge date', () => {
    expect(projectMonthlyCharges(null, SubscriptionFrequency.MONTHLY, FROM, 4)).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('returns zeros when the next charge is beyond the horizon', () => {
    const buckets = projectMonthlyCharges(
      new Date(2027, 5, 1),
      SubscriptionFrequency.ANNUAL,
      FROM,
      6,
    );
    expect(buckets).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('chargeAt', () => {
  it('clamps the day to the length of the target month', () => {
    const feb = chargeAt(new Date(2026, 0, 31), SubscriptionFrequency.MONTHLY, 1);
    expect(feb.getMonth()).toBe(1);
    expect(feb.getDate()).toBe(28);
  });

  it('keeps the original day once the month is long enough again', () => {
    const mar = chargeAt(new Date(2026, 0, 31), SubscriptionFrequency.MONTHLY, 2);
    expect(mar.getMonth()).toBe(2);
    expect(mar.getDate()).toBe(31);
  });
});

describe('splitMonthCharges', () => {
  const TODAY = new Date(2026, 9, 15); // 15 Oct 2026

  it('counts a charge already rolled forward by the cron as paid', () => {
    // Charged on the 10th; the cron moved the next charge to 10 Nov.
    expect(
      splitMonthCharges(new Date(2026, 10, 10), SubscriptionFrequency.MONTHLY, TODAY),
    ).toEqual({ paid: 1, unpaid: 0 });
  });

  it('counts a charge later this month as unpaid', () => {
    expect(
      splitMonthCharges(new Date(2026, 9, 20), SubscriptionFrequency.MONTHLY, TODAY),
    ).toEqual({ paid: 0, unpaid: 1 });
  });

  it('counts a charge due today as paid', () => {
    expect(splitMonthCharges(TODAY, SubscriptionFrequency.MONTHLY, TODAY)).toEqual({
      paid: 1,
      unpaid: 0,
    });
  });

  it('splits weekly charges around today', () => {
    // Fridays in Oct 2026: 2, 9 paid; 16, 23, 30 still to come.
    expect(
      splitMonthCharges(new Date(2026, 9, 16), SubscriptionFrequency.WEEKLY, TODAY),
    ).toEqual({ paid: 2, unpaid: 3 });
  });

  it('leaves out an annual charge billed in another month', () => {
    expect(
      splitMonthCharges(new Date(2027, 2, 3), SubscriptionFrequency.ANNUAL, TODAY),
    ).toEqual({ paid: 0, unpaid: 0 });
  });

  it('catches up a stale next charge from an earlier month', () => {
    expect(
      splitMonthCharges(new Date(2026, 8, 25), SubscriptionFrequency.MONTHLY, TODAY),
    ).toEqual({ paid: 0, unpaid: 1 });
  });

  it('returns nothing without a charge date', () => {
    expect(splitMonthCharges(null, SubscriptionFrequency.MONTHLY, TODAY)).toEqual({
      paid: 0,
      unpaid: 0,
    });
  });
});

describe('countChargesBetween', () => {
  const from = new Date(2026, 4, 8);
  const to = new Date(2026, 4, 31);

  it('counts the charges between two days, both included', () => {
    expect(countChargesBetween('2026-05-11', SubscriptionFrequency.WEEKLY, from, to)).toBe(3);
    expect(countChargesBetween('2026-05-08', SubscriptionFrequency.WEEKLY, from, to)).toBe(4);
    expect(countChargesBetween('2026-05-31', SubscriptionFrequency.MONTHLY, from, to)).toBe(1);
  });

  it('catches a stale next charge up and leaves out days before the range', () => {
    expect(countChargesBetween('2026-04-03', SubscriptionFrequency.WEEKLY, from, to)).toBe(4);
  });

  it('leaves out charges already paid ahead of their day', () => {
    expect(
      countChargesBetween('2026-05-11', SubscriptionFrequency.WEEKLY, from, to, new Set(['2026-05-11'])),
    ).toBe(2);
  });

  it('counts nothing without a next charge', () => {
    expect(countChargesBetween(null, SubscriptionFrequency.MONTHLY, from, to)).toBe(0);
  });
});
