import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: getMock,
  },
}));

import { fetchAuditEvents, fetchEntityHistory } from './audit';

describe('fetchEntityHistory', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('returns history payload on success', async () => {
    const payload = [
      {
        id: 'evt-1',
        workspaceId: 'ws-1',
        createdAt: '2026-01-15T10:00:00.000Z',
        actorType: 'user',
        actorId: 'user-1',
        actorLabel: 'Member One',
        entityType: 'table_row',
        entityId: 'row-1',
        action: 'update',
        description: null,
        diff: null,
        meta: null,
        batchId: null,
        severity: 'info',
        isUndoable: false,
      },
    ];
    getMock.mockResolvedValueOnce({ data: payload });

    await expect(fetchEntityHistory('table_row', 'row-1')).resolves.toEqual(payload);
    expect(getMock).toHaveBeenCalledWith('/audit-events/entity/table_row/row-1');
  });

  it('returns empty array when API returns 403', async () => {
    getMock.mockRejectedValueOnce({ response: { status: 403 } });

    await expect(fetchEntityHistory('table_cell', 'row-1')).resolves.toEqual([]);
  });

  it('rethrows non-403 errors', async () => {
    const error = { response: { status: 500 } };
    getMock.mockRejectedValueOnce(error);

    await expect(fetchEntityHistory('table_cell', 'row-1')).rejects.toEqual(error);
  });
});

describe('fetchAuditEvents', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('forwards action and actorLabel filters', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [], total: 0, page: 1, limit: 50 } });

    await fetchAuditEvents({ action: 'update', actorLabel: 'admin' });

    expect(getMock).toHaveBeenCalledWith('/audit-events', {
      params: { action: 'update', actorLabel: 'admin' },
    });
  });
});
