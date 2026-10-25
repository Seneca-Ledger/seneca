'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Alert } from '@/app/components/ui/alert';
import { NotificationDeliveryCard } from '@/app/settings/profile/components/NotificationDeliveryCard';
import {
  type NotificationChannel,
  type NotificationPreferences,
  type NotificationSettings,
  notificationChannels,
  systemNotificationSettings,
  workspaceNotificationSettings,
} from '@/app/settings/profile/profileHelpers';
import { tokens } from '@/lib/theme-tokens';

type NotificationKey = keyof NotificationPreferences;
type Tx = (path: string[], fallback: string) => string;
type ToggleChannel = (
  key: NotificationKey,
  channel: NotificationChannel,
  value: boolean,
) => Promise<void>;

/** Label column plus one narrow column per channel. A phone has no room for
 * both (the label was squeezed to a word a line and the fourth channel wrapped),
 * so there the label takes a line of its own and the channels share the next. */
const ROW_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: `repeat(${notificationChannels.length}, minmax(0, 1fr))`,
    sm: `minmax(0, 1fr) repeat(${notificationChannels.length}, 64px)`,
  },
};

const CHANNEL_FALLBACKS: Record<NotificationChannel, string> = {
  inApp: 'Bell',
  email: 'Email',
  telegram: 'Telegram',
  push: 'Push',
};

type Props = {
  tx: Tx;
  notificationError: string | null;
  notificationMessage: string | null;
  notificationsLoading: boolean;
  notificationSettings: NotificationSettings;
  notificationSavingKey: NotificationKey | 'delivery' | null;
  toggleNotificationChannel: ToggleChannel;
  updateDelivery: (patch: Partial<Omit<NotificationSettings, 'channels'>>) => void;
};

function ChannelHeader({ tx }: { tx: Tx }) {
  return (
    <Box sx={{ ...ROW_GRID, px: 1.5, pb: 0.5 }}>
      <Box component="span" sx={{ display: { xs: 'none', sm: 'block' } }} />
      {notificationChannels.map(channel => (
        <Typography
          key={channel}
          variant="caption"
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {tx(['notificationsCard', 'channels', channel], CHANNEL_FALLBACKS[channel])}
        </Typography>
      ))}
    </Box>
  );
}

function NotificationSettingRow({
  tx,
  settingKey,
  settings,
  saving,
  onToggle,
}: {
  tx: Tx;
  settingKey: NotificationKey;
  settings: NotificationSettings;
  saving: boolean;
  onToggle: ToggleChannel;
}) {
  const label = tx(['notificationsCard', 'items', settingKey, 'label'], settingKey);
  const description = tx(['notificationsCard', 'items', settingKey, 'description'], '');
  const row = settings.channels[settingKey];

  return (
    <Box
      sx={{
        ...ROW_GRID,
        alignItems: 'center',
        borderRadius: tokens.radius.lg,
        border: '1px solid',
        borderColor: 'divider',
        p: 1.5,
      }}
    >
      <Stack spacing={0.25} sx={{ pr: 1, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
          }}
        >
          {description}
        </Typography>
      </Stack>
      {notificationChannels.map(channel => (
        <Box key={channel} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Checkbox
            checked={Boolean(row?.[channel])}
            onChange={(_event, value) => void onToggle(settingKey, channel, value)}
            disabled={saving}
            size="small"
            color="primary"
            slotProps={{
              input: {
                'aria-label': `${label} — ${tx(
                  ['notificationsCard', 'channels', channel],
                  CHANNEL_FALLBACKS[channel],
                )}`,
              },
            }}
          />
        </Box>
      ))}
    </Box>
  );
}

function NotificationGroup({
  tx,
  titlePath,
  keys,
  settings,
  savingKey,
  onToggle,
}: {
  tx: Tx;
  titlePath: string;
  keys: Array<{ key: NotificationKey }>;
  settings: NotificationSettings;
  savingKey: NotificationKey | 'delivery' | null;
  onToggle: ToggleChannel;
}) {
  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, pt: 2, pb: 0 }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
          }}
        >
          {tx(['notificationsCard', titlePath, 'title'], '')}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {tx(['notificationsCard', titlePath, 'description'], '')}
        </Typography>
      </Box>
      <CardContent sx={{ overflowX: 'auto' }}>
        <Box>
          <ChannelHeader tx={tx} />
          <Stack spacing={1.5}>
            {keys.map(setting => (
              <NotificationSettingRow
                key={setting.key}
                tx={tx}
                settingKey={setting.key}
                settings={settings}
                saving={savingKey === setting.key}
                onToggle={onToggle}
              />
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export function NotificationsSection({
  tx,
  notificationError,
  notificationMessage,
  notificationsLoading,
  notificationSettings,
  notificationSavingKey,
  toggleNotificationChannel,
  updateDelivery,
}: Props) {
  if (notificationsLoading) {
    return (
      <Box
        sx={{
          borderRadius: tokens.radius.lg,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          px: 2,
          py: 2.5,
          fontSize: 14,
          color: 'text.secondary',
        }}
      >
        {tx(['notificationsCard', 'loading'], 'Loading...')}
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {notificationError ? <Alert variant="error">{notificationError}</Alert> : null}
      {notificationMessage ? <Alert variant="success">{notificationMessage}</Alert> : null}

      <NotificationDeliveryCard
        tx={tx}
        settings={notificationSettings}
        saving={notificationSavingKey === 'delivery'}
        onChange={updateDelivery}
      />

      <NotificationGroup
        tx={tx}
        titlePath="workspace"
        keys={workspaceNotificationSettings}
        settings={notificationSettings}
        savingKey={notificationSavingKey}
        onToggle={toggleNotificationChannel}
      />

      <NotificationGroup
        tx={tx}
        titlePath="system"
        keys={systemNotificationSettings}
        settings={notificationSettings}
        savingKey={notificationSavingKey}
        onToggle={toggleNotificationChannel}
      />
    </Stack>
  );
}
