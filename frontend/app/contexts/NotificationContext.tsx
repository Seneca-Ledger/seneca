'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import apiClient from '@/app/lib/api';
import type { NotificationItem } from '@/app/lib/contracts';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import {
  connectNotificationsSocket,
  disconnectNotificationsSocket,
  getNotificationsSocket,
} from '@/app/lib/socket';
import { useAuthContext } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';

export type { NotificationItem } from '@/app/lib/contracts';

export type NotificationContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  isPending: boolean;
  refetch: () => void;
  markAsRead: (ids: string[]) => void;
  markAllAsRead: () => void;
};

/**
 * Список и счётчик держатся одним запросом, а не двумя: они всегда читаются
 * вместе, а сокет-пуш и обе мутации обязаны обновлять их атомарно — иначе бейдж
 * и список разъезжаются посреди полёта.
 */
interface NotificationsSnapshot {
  items: NotificationItem[];
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const workspaceId = currentWorkspace?.id;
  const queryKey = queryKeys.notifications(workspaceId ?? null);

  const params: Record<string, string> = {};
  if (workspaceId) {
    params.workspaceId = workspaceId;
  }

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<NotificationsSnapshot> => {
      const [list, unread] = await Promise.all([
        apiQueryDecoded({
          url: '/notifications',
          params,
          signal,
          contract: 'NotificationList',
          drift: 'report',
        }),
        apiQueryDecoded({
          url: '/notifications/unread-count',
          params,
          signal,
          contract: 'UnreadCount',
          drift: 'report',
        }),
      ]);
      return { items: list.items, unreadCount: unread.count };
    },
    // `user` реактивен, в отличие от прежнего чтения localStorage: логин в той же
    // вкладке теперь сам запускает загрузку. workspaceLoading сохраняет прежнее
    // правило — не фетчить без скоупа, а потом со скоупом.
    enabled: !workspaceLoading && Boolean(user),
  });

  useEffect(() => {
    if (!user) {
      disconnectNotificationsSocket();
      return;
    }
    // The socket is a module singleton; holding it in state only added a render.
    // `user` above is already the session check — the cookie travels on its own.
    const socket = getNotificationsSocket() ?? connectNotificationsSocket();

    const onNotification = (notification: NotificationItem) => {
      if (workspaceId && notification.workspaceId && notification.workspaceId !== workspaceId) {
        return;
      }

      // setQueryData, а не invalidateQueries: пуш и есть новый элемент,
      // рефетч был бы лишним раундтрипом на каждое событие.
      queryClient.setQueryData<NotificationsSnapshot>(queryKey, previous => {
        if (!previous || previous.items.some(item => item.id === notification.id)) {
          return previous;
        }
        return {
          items: [notification, ...previous.items].slice(0, 50),
          unreadCount: notification.isRead ? previous.unreadCount : previous.unreadCount + 1,
        };
      });
    };

    socket.on('notification:new', onNotification);
    if (workspaceId) {
      socket.emit('join-workspace', { workspaceId });
    }

    return () => {
      socket.off('notification:new', onNotification);
      if (workspaceId) {
        socket.emit('leave-workspace', { workspaceId });
      }
    };
  }, [workspaceId, user, queryClient, queryKey]);

  const markAsReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.post('/notifications/mark-read', {
        ids,
      } satisfies ContractInput<'MarkReadBody'>);
    },
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationsSnapshot>(queryKey);
      queryClient.setQueryData<NotificationsSnapshot>(queryKey, current =>
        current
          ? {
              items: current.items.map(item =>
                ids.includes(item.id) ? { ...item, isRead: true } : item,
              ),
              unreadCount: Math.max(0, current.unreadCount - ids.length),
            }
          : current,
      );
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/mark-all-read', null, { params });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationsSnapshot>(queryKey);
      queryClient.setQueryData<NotificationsSnapshot>(queryKey, current =>
        current
          ? { items: current.items.map(item => ({ ...item, isRead: true })), unreadCount: 0 }
          : current,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markAsRead = useCallback(
    (ids: string[]): void => {
      if (ids.length === 0) return;
      markAsReadMutation.mutate(ids);
    },
    [markAsReadMutation.mutate],
  );

  const markAllAsRead = useCallback((): void => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation.mutate]);

  const refetch = useCallback((): void => {
    void query.refetch();
  }, [query.refetch]);

  const notifications = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;
  const isPending = query.isPending;

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      isPending,
      refetch,
      markAsRead,
      markAllAsRead,
    }),
    [isPending, markAllAsRead, markAsRead, notifications, refetch, unreadCount],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
