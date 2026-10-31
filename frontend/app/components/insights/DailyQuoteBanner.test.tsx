import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayKey } from '@/app/hooks/useDailyQuote';
import { DailyQuoteBanner } from './DailyQuoteBanner';
import { insightPage } from '@/app/test/fixtures/contracts';

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { showDailyQuote: true } as { showDailyQuote?: boolean } }));
const route = vi.hoisted(() => ({ pathname: '/dashboard' }));

vi.mock('@/app/lib/api', () => ({ default: apiMocks }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'de' }),
  useIntlayer: () =>
    new Proxy({}, { get: (_, key: string) => ({ value: key, toString: () => key }) }),
}));

const quote = {
  date: todayKey(),
  quote: {
    id: 'seneca-letter-2',
    text: 'It is not the man who has too little, but the man who craves more, that is poor.',
    author: 'Seneca',
    source: 'Moral Letters to Lucilius, Letter 2',
    sourceUrl: 'https://example.org/letter-2',
  },
  theme: 'temperance',
  reason: { insightId: 'i1', type: 'stoic.intent_gap', title: 'Leisure takes more than you planned' },
  vote: null,
};

describe('DailyQuoteBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    // Every other URL answers the quote; the insight feed answers an empty page.
    apiMocks.get.mockReset().mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/insights' ? insightPage([]) : quote }),
    );
  });

  it('shows the quote, its source and the advice it answers', async () => {
    renderWithQuery(<DailyQuoteBanner />);

    expect(await screen.findByText(quote.quote.text)).toBeTruthy();
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/insights/daily-quote',
      expect.objectContaining({ params: { date: quote.date, locale: 'de' } }),
    );
    expect(screen.getByRole('link', { name: quote.quote.source }).getAttribute('href')).toBe(
      quote.quote.sourceUrl,
    );
    expect(
      screen.getByRole('link', { name: 'quoteWhy Leisure takes more than you planned' }),
    ).toBeTruthy();
  });

  it('shows nothing and asks for no quote when turned off in settings', async () => {
    auth.user = { showDailyQuote: false };
    renderWithQuery(<DailyQuoteBanner />);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(screen.queryByText(quote.quote.text)).toBeNull();
    expect(apiMocks.get).not.toHaveBeenCalledWith('/insights/daily-quote', expect.anything());
    auth.user = { showDailyQuote: true };
  });

  it('stays off on top spenders without asking for a quote', async () => {
    route.pathname = '/reports';
    renderWithQuery(<DailyQuoteBanner />);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(screen.queryByText(quote.quote.text)).toBeNull();
    expect(apiMocks.get).not.toHaveBeenCalledWith('/insights/daily-quote', expect.anything());
    route.pathname = '/dashboard';
  });

  it('stays hidden for the rest of the day once closed', async () => {
    const first = renderWithQuery(<DailyQuoteBanner />);
    fireEvent.click(await screen.findByRole('button', { name: 'quoteDismiss' }));
    expect(screen.queryByText(quote.quote.text)).toBeNull();
    first.unmount();

    renderWithQuery(<DailyQuoteBanner />);
    await Promise.resolve();
    expect(screen.queryByText(quote.quote.text)).toBeNull();
    expect(localStorage.getItem('seneca:daily-quote-dismissed:ws-1')).toBe(quote.date);
  });

  it('greets only the first page of the day: leaving it closes the quote until tomorrow', async () => {
    const client = createTestQueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <DailyQuoteBanner />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(quote.quote.text)).toBeTruthy();

    // The layout keeps the banner mounted while the page under it changes.
    route.pathname = '/budgets';
    view.rerender(
      <QueryClientProvider client={client}>
        <DailyQuoteBanner />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.queryByText(quote.quote.text)).toBeNull());
    expect(localStorage.getItem('seneca:daily-quote-dismissed:ws-1')).toBe(quote.date);
    route.pathname = '/dashboard';
  });

  it('waits while the strip of things to do is showing', async () => {
    apiMocks.get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/insights'
            ? insightPage([
                {
                  id: 'i2',
                  type: 'operational.uncategorized_count',
                  category: 'operational',
                  severity: 'warn',
                  title: 'Uncategorized',
                  message: '12 transactions have no category.',
                  messageKey: null,
                  messageParams: null,
                  data: { count: 12 },
                  createdAt: '2026-08-01T00:00:00.000Z',
                },
              ])
            : quote,
      }),
    );
    renderWithQuery(<DailyQuoteBanner />);
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByText(quote.quote.text)).toBeNull();
  });

  it('presses a thumb, sends it for the reader day, and takes it back on a second press', async () => {
    apiMocks.put
      .mockReset()
      .mockImplementation((_url: string, body: { vote: number }) =>
        Promise.resolve({ data: { vote: body.vote === 0 ? null : body.vote } }),
      );
    renderWithQuery(<DailyQuoteBanner />);
    const more = await screen.findByRole('button', { name: 'quoteMore' });
    const url = `/insights/daily-quote/${quote.quote.id}/vote`;

    fireEvent.click(more);
    await waitFor(() => expect(more.getAttribute('aria-pressed')).toBe('true'));
    expect(apiMocks.put).toHaveBeenLastCalledWith(url, { vote: 1, date: quote.date });

    fireEvent.click(screen.getByRole('button', { name: 'quoteLess' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'quoteLess' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
    expect(more.getAttribute('aria-pressed')).toBe('false');
    expect(apiMocks.put).toHaveBeenLastCalledWith(url, { vote: -1, date: quote.date });

    fireEvent.click(screen.getByRole('button', { name: 'quoteLess' }));
    expect(apiMocks.put).toHaveBeenLastCalledWith(url, { vote: 0, date: quote.date });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'quoteLess' }).getAttribute('aria-pressed')).toBe(
        'false',
      ),
    );
    // The quote stays on screen: a thumb is not a close.
    expect(screen.getByText(quote.quote.text)).toBeTruthy();
  });

  it('puts the previous thumb back when the vote fails', async () => {
    let fail: (error: Error) => void = () => undefined;
    apiMocks.put.mockReset().mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    renderWithQuery(<DailyQuoteBanner />);
    const more = await screen.findByRole('button', { name: 'quoteMore' });

    fireEvent.click(more);
    await waitFor(() => expect(more.getAttribute('aria-pressed')).toBe('true'));
    fail(new Error('offline'));
    await waitFor(() => expect(more.getAttribute('aria-pressed')).toBe('false'));
    expect(apiMocks.put).toHaveBeenCalledTimes(1);
  });

  it('comes back when the day changes', async () => {
    localStorage.setItem('seneca:daily-quote-dismissed:ws-1', '2000-01-01');
    renderWithQuery(<DailyQuoteBanner />);
    expect(await screen.findByText(quote.quote.text)).toBeTruthy();
  });
});
