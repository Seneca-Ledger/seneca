// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { walletItem } from '@/app/test/fixtures/contracts';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiPatch = vi.hoisted(() => vi.fn());
const apiDelete = vi.hoisted(() => vi.fn());
const reactActEnvironmentFlag = 'IS_REACT_ACT_ENVIRONMENT';

vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete },
}));

import { BankSyncPanel } from './BankSyncPanel';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const account = (overrides: Record<string, unknown> = {}) => ({
  id: 'ACT-A',
  name: 'Checking',
  org: 'Demo Bank',
  currency: 'USD',
  enabled: true,
  walletId: null,
  linkId: null,
  lastSyncAt: null,
  balance: 2957.5,
  balanceDate: null,
  consentExpiresAt: null,
  syncFrom: null,
  health: 'ok',
  lastError: null,
  balanceDrift: null,
  ...overrides,
});

const connection = (overrides: Record<string, unknown> = {}, accounts = [account()]) => ({
  id: 'c1',
  provider: 'simplefin',
  linkStyle: 'token',
  label: 'Bridge A',
  status: 'connected',
  config: {
    label: 'Bridge A',
    autoSync: true,
    links: [],
    accounts,
    lastSyncAt: null,
    lastError: null,
    ...((overrides.config as Record<string, unknown>) ?? {}),
  },
  ...overrides,
});

const providers = [
  { key: 'simplefin', linkStyle: 'token' },
  { key: 'enablebanking', linkStyle: 'redirect' },
];

function serveConnections(connections: unknown[]): void {
  apiGet.mockImplementation((url: string) => {
    if (url === '/wallets') {
      return Promise.resolve(apiResponse([walletItem({ id: 'w1', name: 'Main', currency: 'USD' })]));
    }
    if (url.endsWith('/providers')) return Promise.resolve(apiResponse(providers));
    if (url.endsWith('/connections')) return Promise.resolve(apiResponse(connections));
    return Promise.resolve(apiResponse([]));
  });
}

async function mount(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<BankSyncPanel />);
  });
  await act(async () => {
    await flushPromises();
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

const buttonWith = (container: HTMLElement, text: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll('button')).find(
    button => button.textContent === text,
  ) as HTMLButtonElement;

describe('BankSyncPanel', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>)[reactActEnvironmentFlag] = true;
    apiGet.mockReset();
    apiPost.mockReset();
    apiPatch.mockReset();
    apiDelete.mockReset();
  });

  it('lists a connection with its accounts and saves an account change as it is made', async () => {
    serveConnections([connection()]);
    apiPatch.mockResolvedValue(apiResponse(connection()));
    const { container, unmount } = await mount();

    expect(container.textContent).toContain('Bridge A');
    expect(container.textContent).toContain('Checking');
    expect(container.textContent).toContain('Demo Bank');

    const toggle = container.querySelector(
      '[data-testid="bank-sync-account-ACT-A"] input[type="checkbox"]',
    ) as HTMLInputElement;
    await act(async () => {
      toggle.click();
      await flushPromises();
    });
    // No separate save button to forget: the change goes straight out.
    expect(apiPatch).toHaveBeenCalledWith(
      '/integrations/bank-sync/connections/c1/accounts/ACT-A',
      { enabled: false },
    );

    unmount();
  });

  it('pulls a connection and reports what came in', async () => {
    serveConnections([connection()]);
    apiPost.mockResolvedValue(
      apiResponse({
        ok: true,
        imported: 2,
        statements: 1,
        accounts: [
          { id: 'ACT-A', imported: 2, skipped: 0, statementId: 'stmt-1', health: 'ok' },
        ],
      }),
    );
    const { container, unmount } = await mount();

    await act(async () => {
      buttonWith(container, 'Pull now').click();
      await flushPromises();
    });
    expect(apiPost).toHaveBeenCalledWith('/integrations/bank-sync/connections/c1/sync');
    expect(container.textContent).toContain('2 rows');

    unmount();
  });

  it('offers no provider switch until there is somewhere to switch to', async () => {
    serveConnections([connection({}, [account({ walletId: 'w1' })])]);
    const { container, unmount } = await mount();
    expect(container.querySelector('[data-testid="bank-sync-switch-ACT-A"]')).toBeNull();
    unmount();
  });

  it('moves a wallet’s feed to the other connection and says where it will resume', async () => {
    serveConnections([
      connection({}, [account({ walletId: 'w1' })]),
      connection({ id: 'c2', label: 'Bridge B' }, [account({ id: 'ACT-B', name: 'Savings' })]),
    ]);
    apiPost.mockResolvedValue(
      apiResponse({
        from: { connectionId: 'c1', accountId: 'ACT-A' },
        syncFrom: '2026-09-29T00:00:00.000Z',
      }),
    );
    const { container, unmount } = await mount();

    await act(async () => {
      (
        container.querySelector('[data-testid="bank-sync-switch-ACT-A"]') as HTMLButtonElement
      ).click();
      await flushPromises();
    });

    const select = document.querySelector(
      '[data-testid="bank-sync-switch-dialog"] select',
    ) as HTMLSelectElement;
    // The feed being replaced is not offered as its own destination.
    expect(Array.from(select.options).map(option => option.value)).toEqual(['', 'c2::ACT-B']);

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(select, 'c2::ACT-B');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      (
        document.querySelector('[data-testid="bank-sync-switch-confirm"]') as HTMLButtonElement
      ).click();
      await flushPromises();
    });

    expect(apiPost).toHaveBeenCalledWith('/integrations/bank-sync/feeds/switch', {
      walletId: 'w1',
      toConnectionId: 'c2',
      toAccountId: 'ACT-B',
    });
    expect(container.textContent).toContain('New rows from');

    unmount();
  });

  it('names the feeds that stopped delivering and offers to move them', async () => {
    serveConnections([
      connection({}, [account({ walletId: 'w1', health: 'stale' })]),
      connection({ id: 'c2', label: 'Bridge B' }, [account({ id: 'ACT-B', name: 'Savings' })]),
    ]);
    const { container, unmount } = await mount();

    const banner = container.querySelector('[data-testid="bank-sync-unhealthy-banner"]');
    expect(banner?.textContent).toContain('Checking');
    expect(container.querySelector('[data-testid="bank-sync-health-ACT-A"]')?.textContent).toContain(
      'stopped updating the balance',
    );

    await act(async () => {
      (
        container.querySelector(
          '[data-testid="bank-sync-switch-suggestion-ACT-A"]',
        ) as HTMLButtonElement
      ).click();
      await flushPromises();
    });
    expect(document.querySelector('[data-testid="bank-sync-switch-dialog"]')).not.toBeNull();

    unmount();
  });

  it('asks for application credentials instead of a token for a browser-authorized provider', async () => {
    serveConnections([]);
    const { container, unmount } = await mount();

    expect(container.textContent).toContain('No connections yet');
    const select = container.querySelector(
      '[data-testid="bank-sync-add-connection"] select',
    ) as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;

    await act(async () => {
      setter?.call(select, 'simplefin');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="bank-sync-token"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bank-sync-private-key"]')).toBeNull();

    await act(async () => {
      setter?.call(select, 'enablebanking');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="bank-sync-token"]')).toBeNull();
    expect(container.querySelector('[data-testid="bank-sync-application-id"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bank-sync-private-key"]')).not.toBeNull();

    unmount();
  });
});
