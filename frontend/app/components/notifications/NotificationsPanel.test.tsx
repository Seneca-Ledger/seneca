// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAppPanel, openAppPanel } from '@/app/components/panels/app-panels-store';
import { NotificationsPanel } from './NotificationsPanel';

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({
  markAsRead: vi.fn(),
  refetch: vi.fn(),
}));

const drawerMocks = vi.hoisted(() => ({
  lastOpen: false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerMocks.push }),
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    aria: { notifications: { value: 'Notifications' } },
    title: { value: 'Notifications' },
    markAllRead: { value: 'Mark all as read' },
    loading: { value: 'Loading' },
    empty: { value: 'Empty' },
    settingsLink: { value: 'Notification settings' },
    justNow: { value: 'just now' },
    notificationTypes: {
      receiptUncategorized: {
        title: { value: 'Receipt without category' },
        message: { value: 'Receipt "{{name}}" has no category' },
        messageFallback: { value: 'Found a receipt without category' },
      },
      transactionUncategorized: {
        title: { value: 'Transactions without category' },
        messageSingular: { value: '{{count}} transaction needs a category' },
        messagePlural: { value: '{{count}} transactions need a category' },
      },
    },
  }),
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: unknown;
    children: React.ReactNode;
  }) => {
    drawerMocks.lastOpen = isOpen;
    if (!isOpen) {
      return null;
    }
    // The dictionary mock hands back `{ value }` nodes, which only intlayer renders.
    const heading = (title as { value?: string } | null)?.value ?? '';
    return (
      <div data-testid="notification-panel">
        <div>{heading}</div>
        {children}
      </div>
    );
  },
}));

vi.mock('@/app/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: 'notification-1',
        type: 'receipt.uncategorized',
        entityType: 'receipt',
        entityId: 'receipt-1',
        meta: null,
        severity: 'warn',
        title: 'Receipt without category',
        message: 'Receipt "[GitHub] Payment Receipt" has no category',
        createdAt: new Date().toISOString(),
        isRead: false,
      },
      {
        id: 'notification-2',
        type: 'transaction.uncategorized',
        entityType: 'statement',
        entityId: 'statement-1',
        meta: null,
        severity: 'warn',
        title: 'Transactions without category',
        message: '1 transaction needs a category',
        createdAt: new Date().toISOString(),
        isRead: false,
      },
      {
        id: 'notification-3',
        type: 'transaction.uncategorized',
        entityType: 'review-inbox',
        entityId: 'workspace-1',
        meta: { counts: { total: 11 } },
        severity: 'info',
        title: 'Items waiting for review',
        message: '11 items are waiting in the review inbox',
        createdAt: new Date().toISOString(),
        isRead: false,
      },
    ],
    unreadCount: 3,
    isPending: false,
    refetch: notificationMocks.refetch,
    markAsRead: notificationMocks.markAsRead,
    markAllAsRead: vi.fn(),
  }),
}));

describe('NotificationsPanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    routerMocks.push.mockReset();
    notificationMocks.markAsRead.mockReset();
    notificationMocks.refetch.mockReset();
    drawerMocks.lastOpen = false;
    closeAppPanel();
  });

  it('opens the notifications panel when the account menu asks for it', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<NotificationsPanel />);
    });

    expect(drawerMocks.lastOpen).toBe(false);

    await act(async () => {
      openAppPanel('notifications');
    });

    expect(drawerMocks.lastOpen).toBe(true);
    expect(document.querySelector('[data-testid="notification-panel"]')).toBeTruthy();
    expect(notificationMocks.refetch).toHaveBeenCalled();
  });

  it('routes to receipt details for uncategorized receipts', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<NotificationsPanel />);
    });

    await act(async () => {
      openAppPanel('notifications');
    });

    const receiptNotification = Array.from(document.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Receipt without category'),
    );

    expect(receiptNotification).toBeTruthy();

    await act(async () => {
      receiptNotification?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(routerMocks.push).toHaveBeenCalledWith('/storage/gmail-receipts/receipt-1');
  });

  it('routes to statement edit for uncategorized transactions', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<NotificationsPanel />);
    });

    await act(async () => {
      openAppPanel('notifications');
    });

    const transactionNotification = Array.from(document.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Transactions without category'),
    );

    expect(transactionNotification).toBeTruthy();

    await act(async () => {
      transactionNotification?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(routerMocks.push).toHaveBeenCalledWith('/statements/statement-1/edit');
  });

  it('opens the review queue for the weekly digest and keeps its own text', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<NotificationsPanel />);
    });

    await act(async () => {
      openAppPanel('notifications');
    });

    const digest = Array.from(document.querySelectorAll('button')).find(button =>
      button.textContent?.includes('11 items are waiting in the review inbox'),
    );

    expect(digest).toBeTruthy();
    expect(digest?.textContent).toContain('Items waiting for review');

    await act(async () => {
      digest?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(routerMocks.push).toHaveBeenCalledWith('/review');
  });

  it('renders localized copy on theme-aware surfaces, not hardcoded white', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<NotificationsPanel />);
    });

    await act(async () => {
      openAppPanel('notifications');
    });

    const title = document.querySelector('[data-testid="notification-panel"]')?.textContent;
    expect(title).toContain('Notifications');
    expect(title).toContain('Receipt without category');
    expect(title).toContain('Transactions without category');
    expect(title).toContain('Receipt "[GitHub] Payment Receipt" has no category');
    expect(title).toContain('1 transaction needs a category');
    expect(/[\u0400-\u04FF]/.test(title || '')).toBe(false);

    const whiteSurface = Array.from(document.querySelectorAll('div')).find(node =>
      node.className.includes('bg-white'),
    );

    expect(whiteSurface).toBeUndefined();
    expect(document.querySelector('[data-testid="notification-panel"]')?.textContent).toContain(
      'Notification settings',
    );
  });
});
