'use client';

import { Box, Button, Stack, Typography, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import { CheckCircle2, Link2Off, RefreshCcw, XCircle } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { tokens } from '@/lib/theme-tokens';
import type { IntegrationStatus } from '../types';

type IntegrationStatusCardProps = {
  status: IntegrationStatus | null;
  title: ReactNode;
  statusLabel: ReactNode;
  saving: boolean;
  syncing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  connectLabel: ReactNode;
  reconnectLabel: ReactNode;
  syncLabel: ReactNode;
  disconnectLabel: ReactNode;
  /** Optional hint shown below the buttons when not connected */
  disconnectedHint?: string;
  /** Optional extra actions rendered after the sync/disconnect buttons */
  extraActions?: ReactNode;
};

// eslint-disable-next-line max-lines-per-function, complexity, @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function IntegrationStatusCard({
  status,
  title,
  statusLabel,
  saving,
  syncing,
  onConnect,
  onDisconnect,
  onSync,
  connectLabel,
  reconnectLabel,
  syncLabel,
  disconnectLabel,
  disconnectedHint,
  extraActions,
}: IntegrationStatusCardProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        borderRadius: tokens.radius.lg,
        border: '1px solid var(--border-color)',
        bgcolor: 'background.paper',
        p: 3,
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      }}
    >
      {/* A phone puts the actions under the status: side by side both were squeezed to a few words a line. */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {status?.connected ? (
            <CheckCircle2 style={{ height: 24, width: 24, color: theme.palette.success.main }} />
          ) : (
            <XCircle style={{ height: 24, width: 24, color: 'var(--destructive)' }} />
          )}
          <Box>
            <Typography style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
              {title}
            </Typography>
            <Typography style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
              {statusLabel}
            </Typography>
          </Box>
        </Box>

        <Stack sx={{ alignItems: { xs: 'flex-start', sm: 'flex-end' } }} spacing={1}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {status?.connected ? (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onSync}
                  disabled={saving || syncing}
                  startIcon={
                    syncing ? (
                      <Spinner size={16} />
                    ) : (
                      <RefreshCcw style={{ height: 16, width: 16 }} />
                    )
                  }
                  sx={{
                    borderRadius: tokens.radius.md,
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    fontWeight: 600,
                    fontSize: 14,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'var(--primary-fill)', color: '#fff' },
                  }}
                >
                  {syncLabel}
                </Button>
                {extraActions}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onDisconnect}
                  disabled={saving}
                  startIcon={
                    saving ? <Spinner size={16} /> : <Link2Off style={{ height: 16, width: 16 }} />
                  }
                  sx={{
                    borderRadius: tokens.radius.md,
                    borderColor: 'var(--border-color)',
                    color: 'var(--foreground)',
                    fontWeight: 600,
                    fontSize: 14,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'var(--muted)' },
                  }}
                >
                  {disconnectLabel}
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                size="small"
                onClick={onConnect}
                disabled={saving}
                startIcon={
                  saving ? <Spinner size={16} /> : <RefreshCcw style={{ height: 16, width: 16 }} />
                }
                sx={{
                  borderRadius: tokens.radius.md,
                  fontWeight: 600,
                  fontSize: 14,
                  textTransform: 'none',
                }}
              >
                {status?.status === 'needs_reauth' ? reconnectLabel : connectLabel}
              </Button>
            )}
          </Box>

          {!status?.connected && disconnectedHint && (
            <Typography
              sx={{
                fontSize: 12,
                color: 'var(--muted-foreground)',
                maxWidth: 280,
                textAlign: { xs: 'left', sm: 'right' },
              }}
            >
              {disconnectedHint}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
