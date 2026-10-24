import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: getMock,
  },
}));

import { fetchAuditEvents } from './audit';

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
