// @vitest-environment jsdom
import { formatStoredDate } from '@/app/lib/user-format-store';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BalanceHistoryDialog } from './BalanceHistoryDialog';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiDelete = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet, post: apiPost, delete: apiDelete },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));

const canEdit = vi.hoisted(() => ({ value: true }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => canEdit.value }),
}));

function render() {
  return renderWithQuery(
    <BalanceHistoryDialog
      accountId="acc-1"
      accountName="Flat"
      isOpen
      onClose={() => undefined}
    />,
  );
}

describe('BalanceHistoryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canEdit.value = true;
    apiGet.mockResolvedValue(
      apiResponse([
        { date: '2026-01-10', amount: 1000, currency: 'KZT' },
        { date: '2026-02-10', amount: 0, currency: 'KZT' },
      ]),
    );
    apiDelete.mockResolvedValue(apiResponse({ deleted: true }));
    apiPost.mockResolvedValue(apiResponse({ imported: 3 }));
  });

  it('shows every day that was entered against the line', async () => {
    render();

    expect(await screen.findByText(formatStoredDate('2026-01-10'))).toBeInTheDocument();
    expect(screen.getByText(formatStoredDate('2026-02-10'))).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith(
      '/reports/balance/accounts/acc-1/history',
      expect.anything(),
    );
  });

  it('takes the wrong day out', async () => {
    render();

    fireEvent.click(await screen.findByLabelText('Remove 2026-02-10'));

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        '/reports/balance/accounts/acc-1/history/2026-02-10',
      ),
    );
  });

  it('sends a chosen file to the import endpoint', async () => {
    render();
    await screen.findByText(formatStoredDate('2026-01-10'));

    // The dialog renders into a portal, so the input is on document, not in the
    // render container.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Date,Amount\n2026-01-10,1000\n'], 'history.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        '/reports/balance/accounts/acc-1/history',
        expect.any(FormData),
      ),
    );
    expect((apiPost.mock.calls[0][1] as FormData).get('file')).toBe(file);
  });

  it('says so when the line has no history yet', async () => {
    apiGet.mockResolvedValue(apiResponse([]));
    render();

    expect(
      await screen.findByText('Nothing has been entered for this line yet'),
    ).toBeInTheDocument();
  });

  it('lets someone who may only read the sheet look, not change', async () => {
    canEdit.value = false;
    render();

    await screen.findByText(formatStoredDate('2026-01-10'));
    expect(screen.queryByLabelText('Remove 2026-02-10')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
