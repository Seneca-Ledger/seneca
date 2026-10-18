'use client';

import Stack from '@mui/material/Stack';
import type React from 'react';
import { Bot, Smartphone } from '@/app/components/icons';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { NotificationsSection } from '@/app/settings/profile/components/NotificationsSection';
import { PushNotificationsCard } from '@/app/settings/profile/components/PushNotificationsCard';
import { SettingsAccordion } from '@/app/settings/profile/components/SettingsAccordion';
import { useNotifications } from '@/app/settings/profile/hooks/useNotifications';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { TelegramSettingsPanel } from '@/app/settings/telegram/TelegramSettingsPanel';

import type { SettingsTabProps } from './types';

export function NotificationsTab({ user }: SettingsTabProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { tx } = useSettingsText();
  const telegramText = useIntlayer('settingsTelegramPage');

  const {
    notificationSettings,
    notificationsLoading,
    notificationSavingKey,
    notificationError,
    notificationMessage,
    toggleNotificationChannel,
    updateDelivery,
  } = useNotifications(!!user, {
    loadError: tx(['notificationsCard', 'errors', 'load'], ''),
    saveError: tx(['notificationsCard', 'errors', 'save'], ''),
    savedMessage: tx(['notificationsCard', 'messages', 'saved'], ''),
  });

  return (
    <Stack spacing={2}>
      <NotificationsSection
        tx={tx}
        notificationError={notificationError}
        notificationMessage={notificationMessage}
        notificationsLoading={notificationsLoading}
        notificationSettings={notificationSettings}
        notificationSavingKey={notificationSavingKey}
        toggleNotificationChannel={toggleNotificationChannel}
        updateDelivery={updateDelivery}
      />

      <SettingsAccordion
        id="push"
        title={tx(['pushCard', 'title'], 'Push on this device')}
        description={tx(['pushCard', 'description'], '')}
        icon={Smartphone}
        defaultExpanded
      >
        <PushNotificationsCard tx={tx} />
      </SettingsAccordion>

      {hasPermission('telegram.view') ? (
        <SettingsAccordion
          id="telegram"
          title={telegramText.title.value}
          description={telegramText.subtitle.value}
          icon={Bot}
          defaultExpanded
        >
          <TelegramSettingsPanel />
        </SettingsAccordion>
      ) : null}
    </Stack>
  );
}
