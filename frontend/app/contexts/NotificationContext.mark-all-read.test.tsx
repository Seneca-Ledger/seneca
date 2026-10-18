// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '../test/query-wrapper';

const api = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: { post: api.post } }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: ({ contract }: { contract: string }) =>
    Promise.resolve(contract === 'UnreadCount' ? { count: 2 } : { items: [] }),
}));
vi.mock('@/app/lib/socket', () => ({
  connectNotificationsSocket: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() }),
  disconnectNotificationsSocket: vi.fn(),
  getNotificationsSocket: () => null,
}));
vi.mock('./WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'ws-1' }, loading: false }),
}));
vi.mock('./AuthContext', () => ({ useAuthContext: () => ({ user: { id: 'user-1' } }) }));

import { NotificationProvider, useNotifications } from './NotificationContext';

function renderNotifications() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <NotificationProvider>{children}</NotificationProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useNotifications(), { wrapper });
}

describe('NotificationProvider markAllAsRead', () => {
  beforeEach(() => {
    api.post.mockReset().mockResolvedValue({ data: {} });
  });

  it('posts without a body: a JSON null is a 400 from the strict body parser', async () => {
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    act(() => result.current.markAllAsRead());

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/notifications/mark-all-read', undefined, {
      params: { workspaceId: 'ws-1' },
    });
  });
});
