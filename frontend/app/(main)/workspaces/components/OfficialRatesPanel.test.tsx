// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  // Every string is its own key plus its placeholders, so the test reads what was filled in.
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => {
          const text = `${String(key)} {{official}}|{{ours}}|{{date}}|{{categories}}|{{count}}`;
          return { value: text, toString: () => text };
        },
      },
    ),
  useLocale: () => ({ locale: 'en' }),
}));

import { type OfficialRatesCheck, OfficialRatesPanel } from './OfficialRatesPanel';

const FOOD = {
  key: 'reduced_missing:4.9:2026-07-01',
  kind: 'reduced_missing' as const,
  official: 4.9,
  ours: null,
  from: '2026-07-01',
  categories: ['FOODSTUFFS'],
  canApply: true,
};

function check(overrides: Partial<OfficialRatesCheck> = {}): OfficialRatesCheck {
  return {
    supported: true,
    country: 'AT',
    fetchedAt: '2026-10-11T05:00:00.000Z',
    sourceUrl: 'https://ec.europa.eu/taxation_customs/tedb/',
    differences: [FOOD],
    dismissed: [],
    ...overrides,
  };
}

describe('OfficialRatesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing where the check does not apply', async () => {
    api.get.mockResolvedValue({ data: check({ supported: false }) });
    const { container } = renderWithQuery(<OfficialRatesPanel />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('lists a missing reduced rate with its date and categories, and adds it', async () => {
    api.get.mockResolvedValue({ data: check() });
    api.post.mockImplementation(async () => {
      // From now on the server has the rate too.
      api.get.mockResolvedValue({ data: check({ differences: [] }) });
      return { data: check({ differences: [] }) };
    });
    renderWithQuery(<OfficialRatesPanel />);

    expect(
      await screen.findByText(/^reducedMissingFrom 4\.9\|\|Jul 1, 2026\| \(foodstuffs\)\|/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^addRate/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/tax/settings/official-rates/apply', {
        key: FOOD.key,
      }),
    );
    expect(await screen.findByText(/^matches/)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it('offers to apply a standard rate change from its date', async () => {
    api.get.mockResolvedValue({
      data: check({
        differences: [
          {
            key: 'standard_changed:22:2027-01-01',
            kind: 'standard_changed',
            official: 22,
            ours: 20,
            from: '2027-01-01',
            categories: [],
            canApply: true,
          },
        ],
      }),
    });
    renderWithQuery(<OfficialRatesPanel />);
    expect(await screen.findByText(/^standardChangedFrom 22\|20\|Jan 1, 2027/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^applyFrom .*Jan 1, 2027/ })).toBeInTheDocument();
  });

  it('has no apply button for a rate that only differs', async () => {
    api.get.mockResolvedValue({
      data: check({
        differences: [
          {
            key: 'reduced_unlisted:4.8',
            kind: 'reduced_unlisted',
            official: null,
            ours: 4.8,
            from: null,
            categories: [],
            canApply: false,
          },
        ],
      }),
    });
    renderWithQuery(<OfficialRatesPanel />);
    expect(await screen.findByText(/^reducedUnlisted \|4\.8\|/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^addRate/ })).not.toBeInTheDocument();
  });

  it('ignores a difference and brings it back', async () => {
    api.get.mockResolvedValue({ data: check() });
    api.put
      .mockResolvedValueOnce({ data: check({ differences: [], dismissed: [FOOD] }) })
      .mockResolvedValueOnce({ data: check() });
    renderWithQuery(<OfficialRatesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /^ignore/ }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/tax/settings/official-rates/dismissed', {
        key: FOOD.key,
        dismissed: true,
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: /^showIgnored .*\|1$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^restore/ }));
    await waitFor(() =>
      expect(api.put).toHaveBeenLastCalledWith('/tax/settings/official-rates/dismissed', {
        key: FOOD.key,
        dismissed: false,
      }),
    );
  });

  it('says so when the Commission could not be reached, and checks again on request', async () => {
    api.get.mockResolvedValue({ data: check({ fetchedAt: null, differences: [] }) });
    api.post.mockResolvedValue({ data: check({ differences: [] }) });
    renderWithQuery(<OfficialRatesPanel />);

    expect(await screen.findByText(/^unreachable/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^checkNow/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/tax/settings/official-rates/refresh', {}),
    );
    expect(await screen.findByText(/^matches/)).toBeInTheDocument();
  });
});
