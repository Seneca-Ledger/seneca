// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { WorkspaceActivityCard } from './WorkspaceActivityCard';

const apiGet = vi.hoisted(() => vi.fn());
const members = vi.hoisted(() => ({ value: [] as Array<{ memberId: string }> }));

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/transactions/hooks/useWorkspaceMembers', () => ({
  useHouseholdMembers: () => members.value,
}));

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'e-1',
  actorName: 'Partner',
  action: 'update',
  entityType: 'transaction',
  entityId: 'tx-1',
  description: 'Changed: category',
  createdAt: '2026-10-05T10:00:00.000Z',
  ...overrides,
});

describe('WorkspaceActivityCard', () => {
  beforeEach(() => {
    apiGet.mockReset();
    members.value = [];
  });

  it('renders nothing for a workspace of one', () => {
    // Every line would say "you did this", which the dashboard already shows.
    const { container } = renderWithQuery(<WorkspaceActivityCard />);
    expect(container.textContent).toBe('');
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('names who made each move once there is a household', async () => {
    members.value = [{ memberId: 'm-1' }, { memberId: 'm-2' }];
    apiGet.mockResolvedValue({ data: { items: [entry()] } });

    const { container } = renderWithQuery(<WorkspaceActivityCard />);

    await waitFor(() => expect(container.textContent).toContain('Partner'));
    expect(container.textContent).toContain('Changed: category');
  });

  it('says so when nothing has happened', async () => {
    members.value = [{ memberId: 'm-1' }, { memberId: 'm-2' }];
    apiGet.mockResolvedValue({ data: { items: [] } });

    const { container } = renderWithQuery(<WorkspaceActivityCard />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container.textContent).toContain('Nobody has changed anything yet');
  });

  it('falls back to the action when an event has no description', async () => {
    members.value = [{ memberId: 'm-1' }, { memberId: 'm-2' }];
    apiGet.mockResolvedValue({ data: { items: [entry({ description: null })] } });

    const { container } = renderWithQuery(<WorkspaceActivityCard />);

    await waitFor(() => expect(container.textContent).toContain('update transaction'));
  });
});
