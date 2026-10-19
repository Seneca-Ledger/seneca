'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import {
  defaultNotificationChannels,
  defaultNotificationSettings,
  type NotificationChannel,
  type NotificationPreferences,
  type NotificationSettings,
} from '@/app/settings/profile/profileHelpers';

export type UseNotificationsMessages = {
  loadError: string;
  saveError: string;
  savedMessage: string;
};

export type NotificationSavingKey = keyof NotificationPreferences | 'delivery' | null;

export type UseNotificationsReturn = {
  notificationSettings: NotificationSettings;
  notificationsLoading: boolean;
  notificationSavingKey: NotificationSavingKey;
  notificationError: string | null;
  notificationMessage: string | null;
  toggleNotificationChannel: (
    key: keyof NotificationPreferences,
    channel: NotificationChannel,
    value: boolean,
  ) => Promise<void>;
  updateDelivery: (patch: Partial<Omit<NotificationSettings, 'channels'>>) => Promise<void>;
};

export function useNotifications(
  isAuthenticated: boolean,
  messages: UseNotificationsMessages,
): UseNotificationsReturn {
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    defaultNotificationSettings,
  );
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationSavingKey, setNotificationSavingKey] = useState<NotificationSavingKey>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;

    const load = async () => {
      setNotificationsLoading(true);
      setNotificationError(null);
      await apiQueryDecoded({
        url: '/notifications/preferences',
        contract: 'NotificationPreferences',
      }).then(
        data => {
          if (!active) return;
          setNotificationSettings({
            // The API fills the matrix in, but a stale row must not blank out the UI.
            channels: { ...defaultNotificationChannels, ...data.channels },
            digestMode: data.digestMode,
            quietHoursStart: data.quietHoursStart,
            quietHoursEnd: data.quietHoursEnd,
          });
        },
        () => {
          if (active) setNotificationError(messages.loadError);
        },
      );
      if (active) setNotificationsLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [isAuthenticated, messages.loadError]);

  const rollbackRef = useRef(notificationSettings);

  /** Applies an optimistic change and rolls it back if the request fails. */
  const save = useCallback(
    async (
      savingKey: NotificationSavingKey,
      next: NotificationSettings,
      payload: Record<string, unknown>,
    ) => {
      setNotificationSavingKey(savingKey);
      setNotificationError(null);
      setNotificationMessage(null);
      // Capture the rollback value from the updater so `save` (and the
      // callbacks built on it) do not change identity on every toggle.
      setNotificationSettings(current => {
        rollbackRef.current = current;
        return next;
      });

      // Promise chain rather than try/finally so React Compiler can memoize
      // this hook.
      await apiClient
        .patch(
          '/notifications/preferences',
          payload satisfies ContractInput<'UpdateNotificationPreferencesBody'>,
        )
        .then(
          () => setNotificationMessage(messages.savedMessage),
          () => {
            setNotificationSettings(rollbackRef.current);
            setNotificationError(messages.saveError);
          },
        );
      setNotificationSavingKey(null);
    },
    [messages.saveError, messages.savedMessage],
  );

  const toggleNotificationChannel = useCallback(
    (key: keyof NotificationPreferences, channel: NotificationChannel, value: boolean) => {
      const nextSet = { ...notificationSettings.channels[key], [channel]: value };

      return save(
        key,
        {
          ...notificationSettings,
          channels: { ...notificationSettings.channels, [key]: nextSet },
        },
        { channels: { [key]: nextSet } },
      );
    },
    [notificationSettings, save],
  );

  const updateDelivery = useCallback(
    (patch: Partial<Omit<NotificationSettings, 'channels'>>) =>
      save('delivery', { ...notificationSettings, ...patch }, patch),
    [notificationSettings, save],
  );

  return {
    notificationSettings,
    notificationsLoading,
    notificationSavingKey,
    notificationError,
    notificationMessage,
    toggleNotificationChannel,
    updateDelivery,
  };
}
