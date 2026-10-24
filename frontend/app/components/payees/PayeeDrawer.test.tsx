// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { PayeeDrawer } from './PayeeDrawer';

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: 'http://api.test' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useIntlayer: () =>
      autoDictionary({
        searchPlaceholder: value('Find payee'),
        createPayee: value('Create "{{name}}"'),
        noMatches: value('Nobody found'),
      }),
  };
});

const store = { id: 'p-store', name: 'ACME Store' };
const bakery = { id: 'p-bakery', name: 'Example Bakery' };
const payee = (ref: { id: string; name: string }) => ({
  ...ref,
  mode: 'auto',
  category: null,
  defaultCategory: null,
  countryCode: null,
  vatId: null,
  vatIdStatus: null,
  vatIdName: null,
  vatIdCheckedAt: null,
  supplyType: null,
  transactionCount: 1,
  lastSeen: null,
});

describe('PayeeDrawer', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({
      data: { data: [payee(store), payee(bakery)], total: 2, page: 1, limit: 50 },
    });
  });

  it('loads nothing while closed', () => {
    renderWithQuery(
      <PayeeDrawer open={false} title="Change payee" current={null} onClose={vi.fn()} onPick={vi.fn()} />,
    );
    expect(api.get).not.toHaveBeenCalled();
  });

  it('picks a payee, or creates one under a new name', async () => {
    const onPick = vi.fn();
    renderWithQuery(
      <PayeeDrawer open title="Change payee" current={store} onClose={vi.fn()} onPick={onPick} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Example Bakery/ }));
    expect(onPick).toHaveBeenCalledWith({ payeeId: bakery.id }, bakery.name);

    fireEvent.change(screen.getByRole('textbox', { name: 'Find payee' }), {
      target: { value: 'Example Cafe' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Create "Example Cafe"' }));
    expect(onPick).toHaveBeenCalledWith({ name: 'Example Cafe' }, 'Example Cafe');
  });

  it('offers only other existing payees when merging', async () => {
    renderWithQuery(
      <PayeeDrawer
        open
        existingOnly
        title="Merge"
        current={store}
        onClose={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    await screen.findByRole('button', { name: /Example Bakery/ });
    expect(screen.queryByRole('button', { name: /ACME Store/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Find payee' }), {
      target: { value: 'Example Cafe' },
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Create/ })).not.toBeInTheDocument(),
    );
  });
});
