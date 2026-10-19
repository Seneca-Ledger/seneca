'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { NotificationSettings } from '@/app/settings/profile/profileHelpers';
import { notificationDigestModes } from '@/app/settings/profile/profileHelpers';

type Tx = (path: string[], fallback: string) => string;

type Props = {
  tx: Tx;
  settings: NotificationSettings;
  saving: boolean;
  onChange: (patch: Partial<Omit<NotificationSettings, 'channels'>>) => void;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const DIGEST_FALLBACKS: Record<string, string> = {
  instant: 'Right away',
  daily: 'Daily summary',
  weekly: 'Weekly summary',
};

function QuietHourSelect({
  label,
  value,
  disabled,
  offLabel,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  offLabel: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value === null ? '' : String(value)}
      disabled={disabled}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
      InputLabelProps={{ shrink: true }}
      SelectProps={{
        // '' is a real choice here ("off"), so it has to render instead of
        // being treated as an empty selection.
        displayEmpty: true,
        // 25 entries overflow the viewport, so the menu scrolls instead of the page.
        MenuProps: { PaperProps: { sx: { maxHeight: 320 } } },
      }}
      sx={{ minWidth: 140 }}
    >
      <MenuItem value="">{offLabel}</MenuItem>
      {HOURS.map(hour => (
        <MenuItem key={hour} value={String(hour)}>
          {formatHour(hour)}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function NotificationDeliveryCard({ tx, settings, saving, onChange }: Props) {
  const offLabel = tx(['notificationsCard', 'quietHoursOff'], 'Off');

  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, pt: 2, pb: 0 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {tx(['notificationsCard', 'deliveryTitle'], 'Delivery')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tx(
            ['notificationsCard', 'deliveryDescription'],
            'How often email and Telegram messages go out, and when to stay silent.',
          )}
        </Typography>
      </Box>
      <CardContent>
        <Stack spacing={2}>
          <TextField
            select
            size="small"
            label={tx(['notificationsCard', 'digestLabel'], 'Frequency')}
            value={settings.digestMode}
            disabled={saving}
            onChange={event =>
              onChange({ digestMode: event.target.value as NotificationSettings['digestMode'] })
            }
            helperText={tx(
              ['notificationsCard', 'digestHelp'],
              'Summaries are sent in the morning, in your time zone.',
            )}
            sx={{ maxWidth: 320 }}
          >
            {notificationDigestModes.map(mode => (
              <MenuItem key={mode} value={mode}>
                {tx(['notificationsCard', 'digestModes', mode], DIGEST_FALLBACKS[mode])}
              </MenuItem>
            ))}
          </TextField>

          <Stack spacing={0.5}>
            <Typography variant="body2" fontWeight={600}>
              {tx(['notificationsCard', 'quietHoursTitle'], 'Quiet hours')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tx(
                ['notificationsCard', 'quietHoursHelp'],
                'Email and Telegram stay quiet in this window and are delivered afterwards. The bell is unaffected.',
              )}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ pt: 1, flexWrap: 'wrap', gap: 1 }}>
              <QuietHourSelect
                label={tx(['notificationsCard', 'quietHoursFrom'], 'From')}
                value={settings.quietHoursStart}
                disabled={saving}
                offLabel={offLabel}
                onChange={value => onChange({ quietHoursStart: value })}
              />
              <QuietHourSelect
                label={tx(['notificationsCard', 'quietHoursTo'], 'To')}
                value={settings.quietHoursEnd}
                disabled={saving}
                offLabel={offLabel}
                onChange={value => onChange({ quietHoursEnd: value })}
              />
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
