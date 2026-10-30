import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet, post: apiPost },
  apiBaseUrl: '/api/v1',
}));
vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { SHARE_NEVER_KEY, shareMailto, TeachShareDialog } from './TeachShareDialog';

const submission = {
  version: 1,
  bankName: 'other',
  institution: 'Northwind Mutual',
  headings: [{ phrase: 'when', role: 'date' }],
  columns: [{ role: 'date', x0: 38, x1: 100 }],
  balances: {},
};
const info = (over: Record<string, unknown> = {}) =>
  apiResponse({ enabled: true, direct: true, email: 'author@example.com', submission, ...over });

describe('TeachShareDialog', () => {
  const location = window.location;
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    localStorage.clear();
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: location, writable: true });
  });

  it('shows exactly what would be sent, and sends only once the user agrees', async () => {
    apiGet.mockResolvedValue(info());
    apiPost.mockResolvedValue(apiResponse({ sent: true }));
    const onClose = vi.fn();
    renderWithQuery(<TeachShareDialog statementId="statement-1" onClose={onClose} />);
    const payload = await screen.findByTestId('teach-share-payload');
    expect(JSON.parse(payload.textContent ?? '')).toEqual(submission);
    expect(screen.getByText(/Symon Baikov/)).toBeTruthy();
    expect(screen.getByText(/author@example\.com/)).toBeTruthy();

    const send = screen.getByTestId('teach-share-send');
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(send);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(apiPost).toHaveBeenCalledWith('/statements/statement-1/teach/share');
    expect(window.location.href).toBe('');
  });

  it('hands the layout to the mail app when the project cannot take it', async () => {
    apiGet.mockResolvedValue(info());
    apiPost.mockRejectedValue(new Error('502'));
    renderWithQuery(<TeachShareDialog statementId="statement-1" onClose={vi.fn()} />);
    await screen.findByTestId('teach-share-payload');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('teach-share-send'));
    await waitFor(() =>
      expect(window.location.href).toBe(shareMailto('author@example.com', submission)),
    );
  });

  it('goes straight to e-mail without the project’s service, and offers nothing when sharing is off', async () => {
    apiGet.mockResolvedValue(info({ direct: false }));
    renderWithQuery(<TeachShareDialog statementId="statement-1" onClose={vi.fn()} />);
    await screen.findByTestId('teach-share-payload');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('teach-share-send'));
    expect(apiPost).not.toHaveBeenCalled();
    expect(window.location.href).toMatch(/^mailto:author@example\.com\?subject=Statement%20layout/);

    apiGet.mockResolvedValue(info({ enabled: false }));
    const onClose = vi.fn();
    renderWithQuery(<TeachShareDialog statementId="statement-2" onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('remembers “don’t ask again”', async () => {
    apiGet.mockResolvedValue(info());
    const onClose = vi.fn();
    renderWithQuery(<TeachShareDialog statementId="statement-1" onClose={onClose} />);
    await screen.findByTestId('teach-share-payload');
    fireEvent.click(screen.getByRole('button', { name: /don.t ask again/i }));
    expect(localStorage.getItem(SHARE_NEVER_KEY)).toBe('1');
    expect(onClose).toHaveBeenCalled();
  });
});
