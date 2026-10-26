// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageTag } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import '@/app/components/dashboard/test-setup';
import { TagFormDialog } from './TagFormDialog';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const tripTag: StorageTag = {
  id: 'tag-1',
  name: 'Summer Trip',
  color: null,
  description: 'Two weeks by the sea',
  tagDate: '2026-07-01',
};

describe('TagFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue(apiResponse(tripTag));
    api.patch.mockResolvedValue(apiResponse(tripTag));
  });

  it('keeps Save disabled until the tag has a name', () => {
    renderWithQuery(<TagFormDialog open tag={null} onClose={vi.fn()} />);

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: tripTag.name } });
    expect(save).toBeEnabled();
  });

  it('creates a tag with only the fields that were filled in', async () => {
    const onClose = vi.fn();
    renderWithQuery(<TagFormDialog open tag={null} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ` ${tripTag.name} ` } });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: tripTag.description },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/tags', {
        name: tripTag.name,
        description: tripTag.description,
        tagDate: undefined,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('edits a tag and clears a description that was emptied', async () => {
    renderWithQuery(<TagFormDialog open tag={tripTag} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Name')).toHaveValue(tripTag.name);
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(`/tags/${tripTag.id}`, {
        name: tripTag.name,
        description: null,
        tagDate: tripTag.tagDate,
      }),
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('refreshes the document lists after a rename, since their rows carry tag names', async () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderWithQuery(<TagFormDialog open tag={tripTag} onClose={vi.fn()} />, { client });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Winter Trip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['statements'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['receipt-documents'] });
    });
  });
});
