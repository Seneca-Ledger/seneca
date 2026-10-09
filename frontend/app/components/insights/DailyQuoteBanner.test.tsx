import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayKey } from '@/app/hooks/useDailyQuote';
import { DailyQuoteBanner } from './DailyQuoteBanner';

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }));
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
};

describe('DailyQuoteBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMocks.get.mockReset().mockResolvedValue({ data: quote });
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
    expect(localStorage.getItem('lumio:daily-quote-dismissed:ws-1')).toBe(quote.date);
  });

  it('waits while an urgent insight banner is showing', async () => {
    apiMocks.get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/insights'
            ? { items: [{ id: 'i2', severity: 'warn', title: 'Category is rising' }] }
            : quote,
      }),
    );
    renderWithQuery(<DailyQuoteBanner />);
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByText(quote.quote.text)).toBeNull();
  });

  it('comes back when the day changes', async () => {
    localStorage.setItem('lumio:daily-quote-dismissed:ws-1', '2000-01-01');
    renderWithQuery(<DailyQuoteBanner />);
    expect(await screen.findByText(quote.quote.text)).toBeTruthy();
  });
});
