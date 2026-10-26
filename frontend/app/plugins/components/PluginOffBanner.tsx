'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { usePluginState } from '../hooks/usePluginState';
import type { PluginKey } from '../types';

/** Shown at the top of a plugin's drawer while the plugin is switched off. */
export function PluginOffBanner({
  plugin,
  message,
}: {
  plugin: PluginKey;
  message: React.ReactNode;
}): React.JSX.Element | null {
  const t = useIntlayer('pluginsPage');
  const { isEnabled, setEnabled, canToggle, pending } = usePluginState();

  if (isEnabled(plugin)) {
    return null;
  }

  return (
    <Box
      role="status"
      sx={theme => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: tokens.radius.md,
        border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
        bgcolor: alpha(theme.palette.warning.main, 0.08),
      })}
    >
      <Typography sx={{ flex: 1, fontSize: 13, color: 'text.primary' }}>
        {message} {canToggle ? null : t.askAdmin}
      </Typography>
      {canToggle ? (
        <Button
          size="small"
          variant="contained"
          disabled={pending === plugin}
          onClick={() => void setEnabled(plugin, true)}
        >
          {t.enable}
        </Button>
      ) : null}
    </Box>
  );
}
