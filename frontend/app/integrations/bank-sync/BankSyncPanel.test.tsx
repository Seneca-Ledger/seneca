// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiDelete = vi.hoisted(() => vi.fn());
const reactActEnvironmentFlag = 'IS_REACT_ACT_ENVIRONMENT';

vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet, post: apiPost, delete: apiDelete },
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const connectedStatus = {
  connected: true,
  status: 'connected',
  settings: {
    autoSync: true,
    accounts: [
      {
        id: 'ACT-1',
        name: 'Checking',
        org: 'Demo Bank',
        currency: 'USD',
        enabled: true,
        walletId: null,
        lastSyncAt: null,
        balance: 2957.5,
        balanceDate: null,
      },
    ],
    lastSyncAt: null,
    lastError: null,
  },
};

describe('BankSyncPanel', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>)[reactActEnvironmentFlag] = true;
    apiGet.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
  });

  it('takes a setup token, lists the accounts and pulls them', async () => {
    apiGet.mockImplementation((url: string) =>
      url === '/wallets'
        ? Promise.resolve({ data: [{ id: 'w1', name: 'Main', currency: 'USD' }] })
        : Promise.resolve({ data: { connected: false, status: 'disconnected', settings: null } }),
    );
    apiPost.mockImplementation((url: string) => {
      if (url === '/integrations/simplefin/connect') return Promise.resolve({ data: connectedStatus });
      if (url === '/integrations/simplefin/sync') {
        return Promise.resolve({ data: { imported: 2, statements: 1, accounts: [{ id: 'ACT-1', imported: 2 }] } });
      }
      return Promise.resolve({ data: connectedStatus });
    });

    const { BankSyncPanel } = await import('./BankSyncPanel');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onConnectionChange = vi.fn();

    await act(async () => {
      root.render(<BankSyncPanel onConnectionChange={onConnectionChange} />);
    });
    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Not connected');
    const setupToken = btoa('https://bridge');
    const tokenInput = container.querySelector('[data-testid="bank-sync-token"]') as HTMLTextAreaElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    await act(async () => {
      nativeSetter?.call(tokenInput, ` ${setupToken} `);
      tokenInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const connectButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Connect',
    ) as HTMLButtonElement;
    await act(async () => {
      connectButton.click();
      await flushPromises();
    });

    expect(apiPost).toHaveBeenCalledWith('/integrations/simplefin/connect', { setupToken });
    expect(onConnectionChange).toHaveBeenCalled();
    expect(container.textContent).toContain('Checking');
    expect(container.textContent).toContain('Demo Bank');

    // After connecting, the status is re-read on sync; answer with the same accounts.
    apiGet.mockImplementation((url: string) =>
      url === '/wallets' ? Promise.resolve({ data: [] }) : Promise.resolve({ data: connectedStatus }),
    );
    const syncButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Pull now',
    ) as HTMLButtonElement;
    await act(async () => {
      syncButton.click();
      await flushPromises();
    });
    expect(apiPost).toHaveBeenCalledWith('/integrations/simplefin/sync');
    expect(container.textContent).toContain('2 rows');

    // Switching the account off and saving sends the per-account settings.
    const toggle = container.querySelector(
      '[data-testid="bank-sync-account-ACT-1"] input[type="checkbox"]',
    ) as HTMLInputElement;
    await act(async () => {
      toggle.click();
    });
    const saveButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Save settings',
    ) as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await flushPromises();
    });
    expect(apiPost).toHaveBeenCalledWith('/integrations/simplefin/settings', {
      autoSync: true,
      accounts: [{ id: 'ACT-1', enabled: false, walletId: null }],
    });

    root.unmount();
    container.remove();
  });
});
