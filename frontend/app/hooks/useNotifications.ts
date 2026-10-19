'use client';

import {
  type NotificationContextValue,
  useNotifications as useNotificationContext,
} from '@/app/contexts/NotificationContext';

export function useNotifications(): NotificationContextValue {
  return useNotificationContext();
}
