// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { DocumentCategoryDrawer } from './DocumentCategoryDrawer';

const api = vi.hoisted(() => ({
  patch: vi.fn(),
  updateReceiptParsedData: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  default: { patch: api.patch },
  gmailReceiptsApi: { updateReceiptParsedData: api.updateReceiptParsedData },
}));

vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: async () => [
    { id: 'c-food', name: 'Food', isEnabled: true, children: [] },
    { id: 'c-off', name: 'Hidden', isEnabled: false, children: [] },
  ],
}));

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));

vi.mock('@/app/lib/invalidate-document-lists', () => ({ invalidateDocumentLists: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const pick = async (source: string | undefined, onClose = vi.fn()) => {
  renderWithQuery(<DocumentCategoryDrawer target={{ id: 'doc-1', source }} onClose={onClose} />);
  fireEvent.click(await screen.findByRole('button', { name: /Food/ }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
};

describe('DocumentCategoryDrawer', () => {
  beforeEach(() => {
    api.patch.mockReset().mockResolvedValue({ data: {} });
    api.updateReceiptParsedData.mockReset().mockResolvedValue({ data: {} });
  });

  it('lists only enabled categories', async () => {
    renderWithQuery(<DocumentCategoryDrawer target={{ id: 'doc-1' }} onClose={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Food/ })).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('saves a statement category on the stored file', async () => {
    await pick('statement');
    expect(api.patch).toHaveBeenCalledWith('/storage/files/doc-1/category', {
      categoryId: 'c-food',
    });
  });

  it('saves a scan category into the receipt parsed data', async () => {
    await pick('scan');
    expect(api.patch).toHaveBeenCalledWith('/receipts/doc-1', {
      parsedData: { categoryId: 'c-food', category: 'Food' },
    });
  });

  it('saves a Gmail receipt category through the Gmail receipts endpoint', async () => {
    await pick('gmail');
    expect(api.updateReceiptParsedData).toHaveBeenCalledWith('doc-1', {
      categoryId: 'c-food',
      category: 'Food',
    });
    expect(api.patch).not.toHaveBeenCalled();
  });
});
