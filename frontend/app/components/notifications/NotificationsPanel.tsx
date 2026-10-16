'use client';
import Divider from '@mui/material/Divider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Settings } from '@/app/components/icons';
import {
  groupNotifications,
  needsAttention,
  notificationActionKey,
} from '@/app/components/notifications/notification-groups';
import { notificationHref } from '@/app/components/notifications/notification-href';
import { closeAppPanel, useAppPanelState } from '@/app/components/panels/app-panels-store';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { InboxLineIcon } from '@/app/components/ui/empty-state-icons';
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

  const groupTitles = {
    attention: t.groupAttention.value,
    today: t.groupToday.value,
    yesterday: t.groupYesterday.value,
    earlier: t.groupEarlier.value,
  };

  const openNotification = (notification: (typeof notifications)[number]): void => {
    if (!notification.isRead) {
      markAsRead([notification.id]);
    }
    const href = notificationHref(notification);
    if (href) {
      handleClose();
      router.push(href);
    }
  };

  return (
    <DrawerShell
      isOpen={open}
      onClose={handleClose}
      position="right"
      width="md"
      title={
        // "Mark all as read" on the title's line, not a row of its own.
        <span className="lumio-notification-panel__title-row">
          <span>{t.title.value}</span>
          <button
            type="button"
            className="lumio-notification-panel__mark-all"
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
          >
            {t.markAllRead.value}
          </button>
        </span>
      }
    >
      <div className="lumio-notification-panel">
        <div className="lumio-notification-panel__list">
          {isPending && notifications.length === 0 ? (
            <div className="lumio-notification-panel__empty">{t.loading.value}</div>
          ) : null}

          {!isPending && notifications.length === 0 ? (
            <EmptyState icon={<InboxLineIcon />} title={t.empty.value} compact />
          ) : null}

          {groupNotifications(notifications).map(group => (
            <section key={group.key} className="lumio-notification-panel__group">
              <h3 className="lumio-notification-panel__group-title">{groupTitles[group.key]}</h3>
              {group.items.map(notification => {
                const href = notificationHref(notification);
                const localizedCopy = getLocalizedNotificationCopy(notification);
                const important = needsAttention(notification);
                // One mark per line: the severity's colour for what needs doing,
                // a sage dot for anything still unread, nothing otherwise.
                const dot = important
                  ? notification.severity === 'error'
                    ? 'error'
                    : 'attention'
                  : notification.isRead
                    ? null
                    : 'unread';
                return (
                  <div
                    key={notification.id}
                    className={`lumio-notification-panel__item${notification.isRead ? '' : ' lumio-notification-panel__item--unread'}`}
                  >
                    <span
                      aria-hidden
                      className={`lumio-notification-panel__dot${dot ? ` lumio-notification-panel__dot--${dot}` : ''}`}
                    />
                    <div className="lumio-notification-panel__item-content">
                      <button
                        type="button"
                        className="lumio-notification-panel__item-main"
                        onClick={() => openNotification(notification)}
                      >
                        <span className="lumio-notification-panel__item-title">
                          {localizedCopy.title}
                        </span>
                        <span className="lumio-notification-panel__item-message">
                          {localizedCopy.message}
                        </span>
                      </button>
                      <p className="lumio-notification-panel__item-meta">
                        {important && href ? (
                          <>
                            <button
                              type="button"
                              className="lumio-notification-panel__item-action"
                              onClick={() => openNotification(notification)}
                            >
                              {t[notificationActionKey(notification.type)].value}
                            </button>
                            {' · '}
                          </>
                        ) : null}
                        {formatRelativeTime(notification.createdAt, locale, t.justNow.value)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <Divider />
        <div className="lumio-notification-panel__footer">
          <Link
            href="/settings/notifications"
            className="lumio-notification-panel__settings-link"
            onClick={() => handleClose()}
          >
            <Settings size={14} aria-hidden />
            {t.settingsLink.value}
          </Link>
        </div>
      </div>
    </DrawerShell>
  );
}
