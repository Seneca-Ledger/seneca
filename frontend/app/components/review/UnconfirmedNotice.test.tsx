// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { UnconfirmedNotice } from './UnconfirmedNotice';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
const i18n = vi.hoisted(() => ({ locale: 'en', dictionary: {} as Record<string, unknown> }));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => i18n.dictionary,
  useLocale: () => ({ locale: i18n.locale }),
}));

describe('UnconfirmedNotice', () => {
  it('says how much waits in Review and links there', async () => {
    apiGet.mockResolvedValue({
      data: { transaction: 4, receipt: 3, duplicate: 0, subscription: 0, total: 7 },
    });

    renderWithQuery(<UnconfirmedNotice />);

    const notice = await screen.findByTestId('unconfirmed-notice');
    expect(notice.textContent).toContain("7 items aren't confirmed yet");
    expect(screen.getByRole('link', { name: 'Review' }).getAttribute('href')).toBe('/review');
    expect(apiGet).toHaveBeenCalledWith('/review-inbox/counts', expect.anything());
  });

  it('names two to four in the few form where a language has one', async () => {
    i18n.locale = 'ru';
    i18n.dictionary = {
      message: { value: '{{count}} записей ещё не подтверждены' },
      messageFew: { value: '{{count}} записи ещё не подтверждены' },
    };
    apiGet.mockResolvedValue({
      data: { transaction: 2, receipt: 0, duplicate: 0, subscription: 0, total: 2 },
    });

    renderWithQuery(<UnconfirmedNotice />);

    const notice = await screen.findByTestId('unconfirmed-notice');
    expect(notice.textContent).toContain('2 записи ещё не подтверждены');
    i18n.locale = 'en';
    i18n.dictionary = {};
  });

  it('stays hidden when nothing waits', async () => {
    apiGet.mockResolvedValue({
      data: { transaction: 0, receipt: 0, duplicate: 0, subscription: 0, total: 0 },
    });

    renderWithQuery(<UnconfirmedNotice />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByTestId('unconfirmed-notice')).toBeNull();
  });
});
