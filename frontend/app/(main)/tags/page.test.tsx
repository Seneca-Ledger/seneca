// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagListItem } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import '@/app/components/dashboard/test-setup';
import TagsPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const trip: TagListItem = {
  id: 'tag-trip',
  name: 'Summer Trip',
  color: null,
  description: 'Two weeks by the sea',
  tagDate: null,
  usageCount: 4,
};
const unused: TagListItem = { ...trip, id: 'tag-unused', name: 'Project Alpha', description: null, usageCount: 0 };

function serve(tags: TagListItem[]) {
  api.get.mockImplementation((url: string) =>
    url === '/tags'
      ? Promise.resolve(apiResponse(tags))
      : Promise.reject(new Error(`Unexpected GET ${url}`)),
  );
}

describe('TagsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.delete.mockResolvedValue(apiResponse({}));
  });

  it('lists tags with their description and usage', async () => {
    serve([trip, unused]);
    renderWithQuery(<TagsPage />);

    expect(await screen.findByText(trip.name)).toBeInTheDocument();
    expect(screen.getByText(trip.description ?? '')).toBeInTheDocument();
    expect(screen.getByText('4 uses')).toBeInTheDocument();
    expect(screen.getByText('Not used')).toBeInTheDocument();
    // Each name carries the tag icon, not a dot.
    for (const name of [trip.name, unused.name]) {
      const cell = screen.getByText(name).parentElement;
      expect(cell?.querySelector('[data-testid="LocalOfferIcon"]')).not.toBeNull();
    }
  });

  it('searches names and descriptions', async () => {
    serve([trip, unused]);
    renderWithQuery(<TagsPage />);

    await screen.findByText(trip.name);
    fireEvent.change(screen.getByLabelText('Search tags'), { target: { value: 'sea' } });

    expect(screen.getByText(trip.name)).toBeInTheDocument();
    expect(screen.queryByText(unused.name)).not.toBeInTheDocument();
  });

  it('deletes a tag after the confirmation', async () => {
    serve([trip]);
    renderWithQuery(<TagsPage />);

    fireEvent.click(await screen.findByRole('button', { name: `Actions: ${trip.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(await screen.findByText('Delete tag?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/tags/${trip.id}`));
  });

  it('refreshes the document lists after deleting a tag', async () => {
    serve([trip]);
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderWithQuery(<TagsPage />, { client });

    fireEvent.click(await screen.findByRole('button', { name: `Actions: ${trip.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['statements'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['receipt-documents'] });
    });
  });

  it('shows a renamed tag right after saving, without a reload', async () => {
    const renamed = { ...trip, name: 'Winter Trip' };
    serve([trip]);
    api.patch.mockImplementation(async () => {
      serve([renamed]);
      return apiResponse(renamed);
    });
    renderWithQuery(<TagsPage />);

    fireEvent.click(await screen.findByRole('button', { name: `Actions: ${trip.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: renamed.name } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(renamed.name)).toBeInTheDocument();
    expect(screen.queryByText(trip.name)).not.toBeInTheDocument();
  });

  it('shows an empty state when the workspace has no tags', async () => {
    serve([]);
    renderWithQuery(<TagsPage />);

    expect(await screen.findByText('No tags yet')).toBeInTheDocument();
  });
});
