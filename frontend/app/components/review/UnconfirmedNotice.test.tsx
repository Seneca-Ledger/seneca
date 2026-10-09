// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { UnconfirmedNotice } from './UnconfirmedNotice';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', () => ({ useIntlayer: () => ({}) }));

describe('UnconfirmedNotice', () => {
  it('says how much waits in Review and links there', async () => {
    apiGet.mockResolvedValue({ data: { total: 7 } });

    renderWithQuery(<UnconfirmedNotice />);

    const notice = await screen.findByTestId('unconfirmed-notice');
    expect(notice.textContent).toContain("7 items aren't confirmed yet");
    expect(screen.getByRole('link', { name: 'Review' }).getAttribute('href')).toBe('/review');
    expect(apiGet).toHaveBeenCalledWith('/review-inbox/counts', expect.anything());
  });

  it('stays hidden when nothing waits', async () => {
    apiGet.mockResolvedValue({ data: { total: 0 } });

    renderWithQuery(<UnconfirmedNotice />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByTestId('unconfirmed-notice')).toBeNull();
  });
});
