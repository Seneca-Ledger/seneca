import { describe, expect, it } from 'vitest';
import { groupNotifications, notificationActionKey } from './notification-groups';

const at = (iso: string, severity: 'info' | 'warn' | 'error' = 'info', id = iso) => ({
  id,
  severity,
  createdAt: iso,
});

describe('groupNotifications', () => {
  it('pins what needs attention on top, then today, yesterday and earlier', () => {
    const now = new Date(2026, 9, 15, 14, 0);
    const groups = groupNotifications(
      [
        at(new Date(2026, 9, 15, 9).toISOString()),
        at(new Date(2026, 9, 14, 20).toISOString(), 'warn', 'vat'),
        at(new Date(2026, 9, 14, 8).toISOString()),
        at(new Date(2026, 9, 11, 8).toISOString(), 'error', 'import'),
        at(new Date(2026, 9, 11, 9).toISOString()),
      ],
      now,
    );

    expect(groups.map(group => [group.key, group.items.length])).toEqual([
      ['attention', 2],
      ['today', 1],
      ['yesterday', 1],
      ['earlier', 1],
    ]);
    expect(groups[0].items.map(item => item.id)).toEqual(['vat', 'import']);
  });

  it('leaves empty groups out', () => {
    const now = new Date(2026, 9, 15, 14, 0);
    expect(groupNotifications([at(new Date(2026, 9, 15, 9).toISOString())], now)).toHaveLength(1);
  });
});

describe('notificationActionKey', () => {
  it('names the action the line leads to', () => {
    expect(notificationActionKey('tax.deadline.overdue')).toBe('actionFileReturn');
    expect(notificationActionKey('payable.overdue')).toBe('actionViewBill');
    expect(notificationActionKey('subscription.upcoming')).toBe('actionViewSubscriptions');
    expect(notificationActionKey('tax.rates.official_changed')).toBe('actionReviewRates');
    expect(notificationActionKey('budget.exceeded')).toBe('actionViewBudget');
    expect(notificationActionKey('receipt.uncategorized')).toBe('actionReview');
    expect(notificationActionKey('member.joined')).toBe('actionOpen');
  });
});
