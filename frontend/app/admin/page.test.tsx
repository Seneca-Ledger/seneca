import type { AuditEvent } from '@/lib/api/audit';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAuditEvents = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { role: 'user' } as { role: string } | null }));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }));

vi.mock('@/lib/api/audit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/audit')>()),
  fetchAuditEvents,
}));

// Imported once at collection: a dynamic import inside a test spends its
// timeout on the module graph under a loaded run.
import AdminPage from './page';

const auditEvent: AuditEvent = {
  id: 'event-1',
  workspaceId: 'workspace-1',
  createdAt: '2026-02-01T12:00:00.000Z',
  actorType: 'user',
  actorId: 'user-1',
  actorLabel: 'Member One',
  entityType: 'transaction',
  entityId: 'txn-123',
  action: 'update',
  description: 'Changed the transaction amount',
  diff: {
    before: { amount: 10 },
    after: { amount: 20 },
  },
  meta: null,
  batchId: null,
  severity: 'warn',
  isUndoable: true,
};

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// The admin page is the audit log alone now: the statements and users tabs
// are gone, and the table gave way to the filter bar and a timeline.
describe('AdminPage audit log', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    fetchAuditEvents.mockReset();
  });

  it('loads the first page of events and lists them under the filter bar', async () => {
    fetchAuditEvents.mockResolvedValue({
      data: [auditEvent],
      total: 1,
      page: 1,
      limit: 50,
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<AdminPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(fetchAuditEvents).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(container.querySelector('.audit-filter-bar input.audit-search')).toBeTruthy();

    const items = container.querySelectorAll('.audit-timeline-card .audit-item');
    expect(items).toHaveLength(1);
    expect(items[0]?.querySelector('.audit-actor')?.textContent).toBe(auditEvent.actorLabel);

    act(() => {
      root.unmount();
    });
  });

  it('links the server administrator, and no one else, to parser health', async () => {
    fetchAuditEvents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
    const rendered = async (role: string) => {
      auth.user = { role };
      const container = document.createElement('div');
      const root = createRoot(container);
      await act(async () => {
        root.render(<AdminPage />);
      });
      const link = container.querySelector('a[href="/admin/parsing"]');
      act(() => {
        root.unmount();
      });
      return link;
    };

    expect(await rendered('admin')).toBeTruthy();
    expect(await rendered('user')).toBeNull();
  });
});
