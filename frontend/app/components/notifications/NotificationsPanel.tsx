'use client';
import Divider from '@mui/material/Divider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AlertTriangle, CircleAlert, Info } from '@/app/components/icons';
import { notificationHref } from '@/app/components/notifications/notification-href';
import { closeAppPanel, useAppPanelState } from '@/app/components/panels/app-panels-store';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { useNotifications } from '@/app/hooks/useNotifications';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatStoredDate } from '@/app/lib/user-format-store';

function formatRelativeTime(value: string, locale: string, justNowLabel: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) {
    return justNowLabel;
  }

  const relativeTime = new Intl.RelativeTimeFormat(locale === 'kk' ? 'kk-KZ' : locale, {
    numeric: 'auto',
  });

  if (minutes < 60) {
    return relativeTime.format(-minutes, 'minute');
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return relativeTime.format(-hours, 'hour');
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return relativeTime.format(-days, 'day');
  }

  return formatStoredDate(date, locale === 'kk' ? 'kk-KZ' : locale);
}

function replaceTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}

function extractReceiptName(message: string): string | null {
  const quoted = message.match(/"([^"]+)"/);
  return quoted?.[1] ?? null;
}

function extractCount(message: string): number | null {
  const match = message.match(/\d+/);
  if (!match) {
    return null;
  }
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function resolveTranslationValue(
  value: string | { value?: string } | undefined,
  fallback: string,
): string {
  return typeof value === 'string' ? value : (value?.value ?? fallback);
}

/**
 * Notifications as the second sidebar everything else in the app uses, opened
 * from the account menu. A panel rather than a dropdown: the list is long, the
 * rows are two lines each, and a popover that tall had to escape the sidebar.
 */
export function NotificationsPanel() {
  const t = useIntlayer('notificationDropdown');
  const { locale } = useLocale();
  const { notifications, unreadCount, isPending, refetch, markAsRead, markAllAsRead } =
    useNotifications();
  const router = useRouter();
  const { panel } = useAppPanelState();
  const open = panel === 'notifications';

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const handleClose = closeAppPanel;

  const receiptUncategorizedTitle = resolveTranslationValue(
    t.notificationTypes?.receiptUncategorized?.title,
    'Receipt without category',
  );
  const receiptUncategorizedMessage = resolveTranslationValue(
    t.notificationTypes?.receiptUncategorized?.message,
    'Receipt "{{name}}" has no category',
  );
  const receiptUncategorizedFallback = resolveTranslationValue(
    t.notificationTypes?.receiptUncategorized?.messageFallback,
    'Found a receipt without category',
  );
  const transactionUncategorizedTitle = resolveTranslationValue(
    t.notificationTypes?.transactionUncategorized?.title,
    'Transactions without category',
  );
  const transactionUncategorizedMessageSingular = resolveTranslationValue(
    t.notificationTypes?.transactionUncategorized?.messageSingular,
    '{{count}} transaction needs a category',
  );
  const transactionUncategorizedMessagePlural = resolveTranslationValue(
    t.notificationTypes?.transactionUncategorized?.messagePlural,
    '{{count}} transactions need a category',
  );

  const getLocalizedNotificationCopy = (notification: {
    type: string;
    entityType: string | null;
    title: string;
    message: string;
    meta: Record<string, unknown> | null;
  }) => {
    if (notification.type === 'receipt.uncategorized') {
      const receiptName = extractReceiptName(notification.message);
      return {
        title: receiptUncategorizedTitle,
        message: receiptName
          ? replaceTemplate(receiptUncategorizedMessage, {
              name: receiptName,
            })
          : receiptUncategorizedFallback,
      };
    }

    // The weekly review digest counts receipts, duplicates and subscriptions
    // too, so the server-rendered "N items are waiting" text is kept as is.
    if (
      notification.type === 'transaction.uncategorized' &&
      notification.entityType !== 'review-inbox'
    ) {
      const metaCount =
        typeof notification.meta?.count === 'number' ? notification.meta.count : null;
      const count = metaCount ?? extractCount(notification.message) ?? 0;

      return {
        title: transactionUncategorizedTitle,
        message: replaceTemplate(
          count === 1
            ? transactionUncategorizedMessageSingular
            : transactionUncategorizedMessagePlural,
          { count },
        ),
      };
    }

    return {
      title: notification.title,
      message: notification.message,
    };
  };

  return (
    <DrawerShell isOpen={open} onClose={handleClose} position="right" width="md" title={t.title}>
      <div className="lumio-notification-panel">
        <div className="lumio-notification-panel__actions">
          <button
            type="button"
            className="lumio-notification-panel__mark-all"
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
          >
            {t.markAllRead.value}
          </button>
        </div>

        <div className="lumio-notification-panel__list">
          {isPending && notifications.length === 0 ? (
            <div className="lumio-notification-panel__empty">{t.loading.value}</div>
          ) : null}

          {!isPending && notifications.length === 0 ? (
            <div className="lumio-notification-panel__empty">
              <EmptyStateIllustration name="notifications" size="sm" />
              {t.empty.value}
            </div>
          ) : null}

          {notifications.map(notification => {
            const href = notificationHref(notification);
            const localizedCopy = getLocalizedNotificationCopy(notification);
            const severityIcon =
              notification.severity === 'error' ? (
                <CircleAlert size={14} style={{ color: 'var(--destructive)' }} />
              ) : notification.severity === 'warn' ? (
                <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
              ) : (
                <Info size={14} style={{ color: 'var(--color-primary)' }} />
              );

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (!notification.isRead) {
                    markAsRead([notification.id]);
                  }

                  if (href) {
                    handleClose();
                    router.push(href);
                  }
                }}
                className={`lumio-notification-panel__item${!notification.isRead ? ' lumio-notification-panel__item--unread' : ''}`}
              >
                <div className="lumio-notification-panel__item-body">
                  <div className="lumio-notification-panel__item-icon">{severityIcon}</div>
                  <div className="lumio-notification-panel__item-content">
                    <div className="lumio-notification-panel__item-header-row">
                      <p className="lumio-notification-panel__item-title">{localizedCopy.title}</p>
                      {!notification.isRead ? (
                        <span className="lumio-notification-panel__unread-dot" />
                      ) : null}
                    </div>
                    <p className="lumio-notification-panel__item-message">
                      {localizedCopy.message}
                    </p>
                    <p className="lumio-notification-panel__item-time">
                      {formatRelativeTime(notification.createdAt, locale, t.justNow.value)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Divider />
        <div className="lumio-notification-panel__footer">
          <Link
            href="/settings/notifications"
            className="lumio-notification-panel__settings-link"
            onClick={() => handleClose()}
          >
            {t.settingsLink.value}
          </Link>
        </div>
      </div>
    </DrawerShell>
  );
}
