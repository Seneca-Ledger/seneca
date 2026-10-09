'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LogOut } from '@/app/components/icons';
import { Alert } from '@/app/components/ui/alert';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { Spinner } from '@/app/components/ui/spinner';
import { formatDateTime, type UserFormatPreferences } from '@/app/lib/user-format';
import { getSessionIcon, type UserSession } from '@/app/settings/profile/profileHelpers';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  t: {
    sessionsCard: {
      lastLoginLabel: { value: string };
      logoutAllButton: { value: string };
    };
  };
  tx: (path: string[], fallback: string) => string;
  sessionsMessage: string | null;
  sessionsError: string | null;
  sessionsLoading: boolean;
  sessions: UserSession[];
  userLastLogin: string | null | undefined;
  logoutSessionLoadingId: string | null;
  handleLogoutSession: (session: UserSession) => Promise<void>;
  handleLogoutAll: () => Promise<void>;
  formatPreferences: UserFormatPreferences;
};

export function SessionsSection({
  t,
  tx,
  sessionsMessage,
  sessionsError,
  sessionsLoading,
  sessions,
  userLastLogin,
  logoutSessionLoadingId,
  handleLogoutSession,
  handleLogoutAll,
  formatPreferences,
}: Props) {
  return (
    <Stack spacing={2.5}>
      <EmptyStateIllustration name="sessions" size="sm" />
      {sessionsMessage && <Alert variant="success">{sessionsMessage}</Alert>}
      {sessionsError && <Alert variant="error">{sessionsError}</Alert>}
      <Alert variant="warning">
        {tx(
          ['sessionsCard', 'securityHint'],
          'Only sign out devices you recognize. Signing out current device ends this session immediately.',
        )}
      </Alert>

      <Box
        sx={{
          borderRadius: tokens.radius.lg,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          px: 2,
          py: 1.5,
          fontSize: 14,
          color: 'text.secondary',
        }}
      >
        <Typography component="span" sx={{ fontWeight: 500, color: 'text.primary', fontSize: 14 }}>
          {t.sessionsCard.lastLoginLabel.value}:
        </Typography>{' '}
        {userLastLogin ? formatDateTime(userLastLogin, formatPreferences) : '—'}
      </Box>

      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {tx(['sessionsCard', 'activeSessionsLabel'], 'Active devices')}
        </Typography>

        {sessionsLoading ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              borderRadius: tokens.radius.lg,
              border: '1px solid',
              borderColor: 'divider',
              px: 2,
              py: 2.5,
              fontSize: 14,
              color: 'text.secondary',
            }}
          >
            <Spinner size={18} />
            {tx(['sessionsCard', 'loadingLabel'], 'Loading sessions...')}
          </Box>
        ) : sessions.length ? (
          <Stack spacing={1}>
            {sessions.map(session => {
              const SessionIcon = getSessionIcon(session.device);
              const isLogoutLoading = logoutSessionLoadingId === session.id;

              return (
                <Box
                  key={session.id}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 2,
                    borderRadius: tokens.radius.lg,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    px: 2,
                    py: 2,
                    alignItems: { md: 'flex-start' },
                    justifyContent: { md: 'space-between' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box
                      sx={{
                        mt: 0.5,
                        display: 'flex',
                        height: 40,
                        width: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: tokens.radius.sm,
                        bgcolor: 'transparent',
                        color: 'primary.main',
                        flexShrink: 0,
                      }}
                    >
                      <SessionIcon size={20} />
                    </Box>
                    <Stack spacing={0.5}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {`${session.device} · ${session.browser}`}
                        </Typography>
                        {session.isCurrent && (
                          <Chip
                            label={tx(['sessionsCard', 'currentSessionBadge'], 'This device')}
                            color="info"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {session.os}
                        {session.ipAddress
                          ? ` · ${tx(['sessionsCard', 'ipLabel'], 'IP')}: ${session.ipAddress}`
                          : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {tx(['sessionsCard', 'lastActiveLabel'], 'Last active')}:{' '}
                        {formatDateTime(session.lastUsedAt, formatPreferences)}
                      </Typography>
                    </Stack>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant={session.isCurrent ? 'contained' : 'outlined'}
                      color={session.isCurrent ? 'error' : 'primary'}
                      onClick={() => handleLogoutSession(session)}
                      disabled={isLogoutLoading}
                      startIcon={isLogoutLoading ? <Spinner size={14} /> : <LogOut size={18} />}
                      size="small"
                    >
                      {tx(['sessionsCard', 'logoutSessionButton'], 'Log out')}
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Box
            sx={{
              borderRadius: tokens.radius.lg,
              border: '1px dashed',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              px: 2,
              py: 3,
              fontSize: 14,
              color: 'text.secondary',
            }}
          >
            {tx(['sessionsCard', 'emptySessionsLabel'], 'No active sessions found.')}
          </Box>
        )}
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="error"
          onClick={handleLogoutAll}
          startIcon={<LogOut size={18} />}
        >
          {t.sessionsCard.logoutAllButton.value}
        </Button>
      </Box>
    </Stack>
  );
}
