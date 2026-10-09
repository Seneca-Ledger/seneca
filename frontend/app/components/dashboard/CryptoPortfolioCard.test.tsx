// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import { CryptoPortfolioCard } from './CryptoPortfolioCard';

const apiGet = vi.hoisted(() => vi.fn());

// `apiBaseUrl` comes along because the card now renders coin logos through the
// API's icon proxy.
vi.mock('@/app/lib/api', () => ({ default: { get: apiGet }, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ portfolio: 'Portfolio value' }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const summaryFor = (income: number, expense: number) => ({
  data: {
    currency: 'EUR',
    portfolioValue: 5532,
    income,
    expense,
    walletCount: 1,
    holdings: [{ asset: 'ETH', amount: '1', value: 5532 }],
  },
});

const format = (value: number) => `${value.toFixed(2)} €`;

describe('CryptoPortfolioCard', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('asks for the dashboard month and shows what came in and went out', async () => {
    apiGet.mockResolvedValue(summaryFor(479.84, 18.23));

    renderWithQuery(<CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />);

    expect(await screen.findByText('+479.84 €')).toBeTruthy();
    expect(screen.getByText('−18.23 €')).toBeTruthy();
    expect(screen.getByText('5532.00 €')).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith(
      '/crypto/summary',
      expect.objectContaining({ params: { month: '2026-08' } }),
    );
  });

  it('refetches when the month changes', async () => {
    apiGet.mockResolvedValueOnce(summaryFor(479.84, 18.23));
    apiGet.mockResolvedValueOnce(summaryFor(29.12, 59.88));

    const client = createTestQueryClient();
    const { rerender } = render(
      <CryptoPortfolioCard formatAmount={format} month="2026-08" monthLabel="August 2026" />,
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await screen.findByText('+479.84 €');

    rerender(<CryptoPortfolioCard formatAmount={format} month="2026-07" monthLabel="July 2026" />);

    // The card holds its place while the new month loads instead of vanishing.
    expect(screen.getByText('5532.00 €')).toBeTruthy();
    expect(await screen.findByText('+29.12 €')).toBeTruthy();
    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith(
        '/crypto/summary',
        expect.objectContaining({ params: { month: '2026-07' } }),
      ),
    );
  });
});
