import type { NotificationItem } from '@/app/contexts/NotificationContext';

export type NotificationGroupKey = 'attention' | 'today' | 'yesterday' | 'earlier';

export interface NotificationGroup<T> {
  key: NotificationGroupKey;
  items: T[];
}

/** Overdue returns and bills, failed imports: pinned on top, whatever their age. */
export const needsAttention = (notification: Pick<NotificationItem, 'severity'>): boolean =>
  notification.severity === 'warn' || notification.severity === 'error';

const DAY_MS = 86_400_000;

/**
 * "Needs attention" first, then the rest by the reader's calendar day: today,
 * yesterday, earlier. The group titles replace a "4 days ago" on every line.
 * Empty groups are left out; order within a group is kept.
 */
export function groupNotifications<T extends Pick<NotificationItem, 'severity' | 'createdAt'>>(
  notifications: T[],
  now: Date = new Date(),
): NotificationGroup<T>[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets: Record<NotificationGroupKey, T[]> = {
    attention: [],
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const notification of notifications) {
    if (needsAttention(notification)) {
      buckets.attention.push(notification);
      continue;
    }
    const at = new Date(notification.createdAt).getTime();
    const key =
      at >= startOfToday ? 'today' : at >= startOfToday - DAY_MS ? 'yesterday' : 'earlier';
    buckets[key].push(notification);
  }
  return (['attention', 'today', 'yesterday', 'earlier'] as const)
    .map(key => ({ key, items: buckets[key] }))
    .filter(group => group.items.length > 0);
}

export type NotificationActionKey =
  | 'actionFileReturn'
  | 'actionViewBill'
  | 'actionViewSubscriptions'
  | 'actionReviewRates'
  | 'actionViewBudget'
  | 'actionReview'
  | 'actionOpen';

/** What the line's link says it will do: "File return", not a bare arrow. */
export function notificationActionKey(type: string): NotificationActionKey {
  if (type.startsWith('tax.deadline.')) {
    return 'actionFileReturn';
  }
  if (type.startsWith('payable.')) {
    return 'actionViewBill';
  }
  if (type.startsWith('subscription.')) {
    return 'actionViewSubscriptions';
  }
  if (type.startsWith('tax.rates.')) {
    return 'actionReviewRates';
  }
  if (type.startsWith('budget.')) {
    return 'actionViewBudget';
  }
  if (type.endsWith('.uncategorized') || type === 'review.waiting') {
    return 'actionReview';
  }
  return 'actionOpen';
}
