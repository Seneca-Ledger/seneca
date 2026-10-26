import type { NotificationItem } from '@/app/contexts/NotificationContext';

type NotificationLink = Pick<NotificationItem, 'type' | 'entityType' | 'entityId' | 'meta'>;

/**
 * Where a notification can be looked at or acted on.
 *
 * `?focus=` names the element the destination page scrolls to and rings in
 * green (targets carry `data-attention`, see useAttentionFocus) — the same
 * convention insight links use, see app/components/insights/insight-href.ts.
 *
 * Notifications written before a field was added to `meta` lack it, so every
 * id-dependent route falls back to the page alone. Returns null when there is
 * nowhere sensible to go; the item then only marks itself read.
 *
 * Push notifications open the same pages through a copy of these rules in
 * backend/src/modules/notifications/notification-url.ts — change both together.
 */
export function notificationHref(notification: NotificationLink): string | null {
  // The weekly review digest reuses `transaction.uncategorized`, but its
  // entityId is the workspace, not a statement.
  if (notification.entityType === 'review-inbox') {
    return '/review';
  }
  const byType = TYPE_ROUTES[notification.type];
  if (byType) {
    return byType(notification);
  }
  return entityRoute(notification);
}

const STATEMENT_TYPES = [
  'transaction.uncategorized',
  'parsing.error',
  'import.failed',
  'statement.uploaded',
  'import.committed',
];

const withFocus = (path: string, focus: string | null): string => {
  if (focus === null) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}focus=${encodeURIComponent(focus)}`;
};

/** Payables and receivables share one entity but live on two pages. */
const payableRoute =
  (status: string | null) =>
  (notification: NotificationLink): string => {
    const page =
      readString(notification.meta, 'direction') === 'receivable'
        ? '/statements/receive'
        : '/statements/pay';
    const id = notification.entityId ?? readString(notification.meta, 'payableId');
    // The list is paginated; filtering by the status the notification is about
    // keeps the row on the first page far more often than the unfiltered list.
    const path = status === null ? page : `${page}?status=${status}`;
    return withFocus(path, id === null ? null : `payable:${id}`);
  };

/** Budget cards are tagged by category (insights only know the category). */
const budgetRoute = (notification: NotificationLink): string => {
  const categoryId = readString(notification.meta, 'categoryId');
  return withFocus('/budgets', categoryId === null ? null : `budget:${categoryId}`);
};

/** Upcoming charges list the soonest subscription first; that is the one to show. */
const subscriptionRoute = (notification: NotificationLink): string =>
  withFocus(
    '/subscriptions',
    notification.entityId === null ? null : `subscription:${notification.entityId}`,
  );

// The threshold matters to a business not yet registered for VAT, and the Tax
// year tab is the one such a workspace has.
const taxRoute = (): string => withFocus('/reports?tab=tax-year', 'tax:threshold');

// A VAT return is filed from the VAT tab; the income tax return from its own page.
const taxDeadlineRoute = (notification: NotificationLink): string =>
  readString(notification.meta, 'kind') === 'income_tax' ? '/tax-declaration' : '/reports?tab=tax';

const TYPE_ROUTES: Record<string, (notification: NotificationLink) => string | null> = {
  'receipt.uncategorized': n => (n.entityId ? `/storage/receipts/${n.entityId}` : entityRoute(n)),
  ...Object.fromEntries(
    STATEMENT_TYPES.map(type => [
      type,
      (n: NotificationLink) => (n.entityId ? `/statements/${n.entityId}/edit` : entityRoute(n)),
    ]),
  ),
  'payable.overdue': payableRoute('overdue'),
  'payable.due_soon': payableRoute(null),
  'payable.marked_paid': payableRoute('paid'),
  'budget.warning': budgetRoute,
  'budget.exceeded': budgetRoute,
  'subscription.upcoming': subscriptionRoute,
  'subscription.detected': subscriptionRoute,
  'tax.threshold.warning': taxRoute,
  'tax.threshold.reached': taxRoute,
  'tax.deadline.upcoming': taxDeadlineRoute,
  'tax.deadline.overdue': taxDeadlineRoute,
  'tax.rates.official_changed': () => withFocus('/workspaces/overview', 'tax:official-rates'),
  'member.invited': () => '/workspaces/members',
  'member.joined': () => '/workspaces/members',
  // A deleted statement can still be restored from the trash; a deleted
  // transaction has nowhere to be shown and falls through to the list.
  'data.deleted': n => (n.entityType === 'statement' ? '/statements/trash' : entityRoute(n)),
};

function entityRoute(notification: NotificationLink): string | null {
  const { entityType, entityId, meta } = notification;

  if (entityType === 'statement' && entityId) {
    return `/statements/${entityId}/edit`;
  }
  if (entityType === 'receipt' && entityId) {
    return '/statements';
  }
  if (entityType === 'category') {
    return '/categories';
  }
  if (entityType === 'workspace') {
    return '/workspaces/overview';
  }
  if (entityType === 'transaction') {
    const statementId = readString(meta, 'statementId');
    return statementId ? `/statements/${statementId}/edit` : '/statements';
  }
  return null;
}

function readString(data: Record<string, unknown> | null, key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
