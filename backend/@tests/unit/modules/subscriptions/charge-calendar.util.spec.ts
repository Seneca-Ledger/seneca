import { SubscriptionFrequency } from '@/entities/subscription.entity';
import {
  chargeAt,
  projectMonthlyCharges,
} from '@/modules/subscriptions/charge-calendar.util';

const FROM = new Date(2026, 0, 15); // 15 Jan 2026

describe('projectMonthlyCharges', () => {
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
