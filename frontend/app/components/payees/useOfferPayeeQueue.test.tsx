// @vitest-environment jsdom
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: `${String(key)} {{count}}` }) }),
}));

import { useOfferPayeeQueue } from './useOfferPayeeQueue';

const REWE = { id: 'payee-rewe', name: 'REWE' };

/** Renders the toast the hook raised and clicks its button with this label. */
function clickInToast(label: RegExp) {
  const draw = toast.custom.mock.calls[0][0] as (t: { visible: boolean }) => ReactElement;
  render(draw({ visible: true }));
  fireEvent.click(screen.getByRole('button', { name: label }));
}

describe('useOfferPayeeQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: {} });
  });

  it('offers the category for the payee rows still waiting, then applies it to them', async () => {
    api.get.mockResolvedValue({ data: { transactionIds: ['tx-1', 'tx-2', 'tx-3'] } });
    const { result } = renderHookWithQuery(() => useOfferPayeeQueue());

    await result.current(REWE, 'cat-food', 'Groceries', ['tx-1']);

    expect(api.get).toHaveBeenCalledWith('/payees/payee-rewe/pending-review', expect.anything());
    expect(toast.custom).toHaveBeenCalledTimes(1);
    clickInToast(/^apply/);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/transactions/bulk-update', {
        items: [
          { id: 'tx-2', updates: { categoryId: 'cat-food' } },
          { id: 'tx-3', updates: { categoryId: 'cat-food' } },
        ],
      }),
    );
  });

  it('asks nothing when no other row of the payee waits', async () => {
    api.get.mockResolvedValue({ data: { transactionIds: ['tx-1'] } });
    const { result } = renderHookWithQuery(() => useOfferPayeeQueue());

    await result.current(REWE, 'cat-food', 'Groceries', ['tx-1']);

    expect(toast.custom).not.toHaveBeenCalled();
  });

  it('changes nothing when the offer is dismissed', async () => {
    api.get.mockResolvedValue({ data: { transactionIds: ['tx-2'] } });
    const { result } = renderHookWithQuery(() => useOfferPayeeQueue());

    await result.current(REWE, 'cat-food', 'Groceries', ['tx-1']);
    clickInToast(/^cancel/);

    expect(api.post).not.toHaveBeenCalled();
  });
});
