import { SubscriptionFrequency } from '../../../../src/entities/subscription.entity';
import {
  costPerUse,
  describePriceChange,
  findDuplicateGroups,
  monthlySetAside,
  vendorKey,
} from '../../../../src/modules/subscriptions/subscription-insights.util';

describe('subscription insights', () => {
  it('describes a price change with its yearly effect, ignoring noise under 5%', () => {
    expect(describePriceChange(10, 10.4, SubscriptionFrequency.MONTHLY)).toBeNull();
    expect(describePriceChange(9.99, 12.99, SubscriptionFrequency.MONTHLY, new Date('2026-06-01'))).toEqual({
      previous: 9.99,
      current: 12.99,
      delta: 3,
      yearlyDelta: 36,
      detectedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(describePriceChange(120, 100, SubscriptionFrequency.ANNUAL)?.yearlyDelta).toBe(-20);
  });

  it('computes a cost per use from what was paid since the counter started', () => {
    const since = new Date('2026-01-01');
    const now = new Date('2026-04-01');
    expect(costPerUse({ amount: 12, frequency: SubscriptionFrequency.MONTHLY, usageCount: 0, usageSince: since }, now)).toBeNull();
    expect(costPerUse({ amount: 12, frequency: SubscriptionFrequency.MONTHLY, usageCount: 6, usageSince: since }, now)).toBe(6);
    expect(costPerUse({ amount: 120, frequency: SubscriptionFrequency.ANNUAL, usageCount: 10, usageSince: since }, now)).toBe(3);
  });

  it('spreads the next charge over the months until it is due', () => {
    expect(monthlySetAside(120, new Date('2026-12-01'), new Date('2026-06-01'))).toBe(20);
    expect(monthlySetAside(120, null)).toBe(120);
    expect(monthlySetAside(120, new Date('2026-06-10'), new Date('2026-06-01'))).toBe(120);
  });

  it('groups the same service across plans, domains and spellings', () => {
    const groups = findDuplicateGroups([
      { vendorName: 'Netflix Premium', vendorDomain: null, status: 'active' },
      { vendorName: 'NETFLIX', vendorDomain: null, status: 'detected' },
      { vendorName: 'Spotify', vendorDomain: 'www.spotify.com', status: 'active' },
      { vendorName: 'Spotify Family', vendorDomain: 'spotify.com', status: 'active' },
      { vendorName: 'Old thing', vendorDomain: null, status: 'cancelled' },
      { vendorName: 'Old thing', vendorDomain: null, status: 'active' },
    ] as any);
    expect(groups.map(group => [group.key, group.items.length])).toEqual([
      ['name:netflix', 2],
      ['domain:spotify.com', 2],
    ]);
    expect(vendorKey({ vendorName: 'Apple iCloud+ 200GB', vendorDomain: null } as any)).toBe('name:apple icloud');
  });
});
