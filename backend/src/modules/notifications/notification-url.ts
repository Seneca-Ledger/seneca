import type { Notification } from '../../entities/notification.entity';

type NotificationLink = Pick<Notification, 'type' | 'entityType' | 'entityId' | 'meta'>;

/**
 * The page a tap on a push notification opens. Mirrors the in-app bell
 * (frontend/app/components/notifications/notification-href.ts) — the two must
 * change together, or the same notification opens two different pages.
 *
 * `?focus=` names the element the destination page scrolls to and highlights.
 * The bell does nothing for a notification with nowhere to go; a push has to
 * open something, so that case lands on the dashboard.
 */
export function notificationUrl(notification: NotificationLink): string {
  return routeFor(notification) ?? '/dashboard';
}

function routeFor(notification: NotificationLink): string | null {
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
    const path = status === null ? page : `${page}?status=${status}`;
    return withFocus(path, id === null ? null : `payable:${id}`);
  };

const budgetRoute = (notification: NotificationLink): string => {
  const categoryId = readString(notification.meta, 'categoryId');
  return withFocus('/budgets', categoryId === null ? null : `budget:${categoryId}`);
};

const subscriptionRoute = (notification: NotificationLink): string =>
  withFocus(
    '/subscriptions',
    notification.entityId === null ? null : `subscription:${notification.entityId}`,
  );

// The threshold only concerns a business not yet registered for VAT, whose
// reports show it on the Tax year tab.
const taxRoute = (): string => withFocus('/reports?tab=tax-year', 'tax:threshold');

// A VAT return is filed from the VAT tab; the income tax return from its own page.
const taxDeadlineRoute = (notification: NotificationLink): string =>
  readString(notification.meta, 'kind') === 'income_tax' ? '/tax-declaration' : '/reports?tab=tax';

const TYPE_ROUTES: Record<string, (notification: NotificationLink) => string | null> = {
  'receipt.uncategorized': n =>
    n.entityId ? `/storage/gmail-receipts/${n.entityId}` : entityRoute(n),
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
    return '/workspaces/categories';
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
