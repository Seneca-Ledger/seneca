/* eslint-disable max-lines */
'use client';

import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useTheme } from 'next-themes';
import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2 } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Spinner } from '@/app/components/ui/spinner';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { formatDateTime } from '@/app/lib/format-datetime';
import { tokens } from '@/lib/theme-tokens';
import { IntegrationStatusCard } from '../components/IntegrationStatusCard';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';

type GmailSettings = {
  labelId?: string | null;
  labelName?: string;
  filterEnabled?: boolean;
  filterConfig?: {
    subjects?: string[];
    senders?: string[];
    hasAttachment?: boolean;
    keywords?: string[];
  };
  watchEnabled?: boolean;
  watchExpiration?: string | null;
  lastSyncAt?: string | null;
  historyId?: string | null;
};

type GmailStatus = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'needs_reauth';
  settings?: GmailSettings | null;
  scopes?: string[];
};

type GmailPageT = ReturnType<typeof useIntlayer<'gmailIntegrationPage'>>;

function GmailLoadingView(): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '60vh',
        alignItems: 'center',
        justifyContent: 'center',
        color: c.ink500,
      }}
    >
      <Spinner size={24} />
    </Box>
  );
}

function GmailNotLoggedInView({ t }: { t: GmailPageT }): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box sx={{ maxWidth: 768, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: 5 }}>
      <Box
        sx={{
          borderRadius: tokens.radius.lg,
          border: `1px solid ${c.ink150}`,
          bgcolor: 'background.paper',
          p: 3,
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
          textAlign: 'center',
        }}
      >
        <Typography style={{ color: c.ink800, fontWeight: 600, marginBottom: 8 }}>
          {t.common.notConnected.value}
        </Typography>
        <Typography style={{ fontSize: 14, color: c.ink700 }}>
          {t.errors.loginRequired.value}
        </Typography>
      </Box>
    </Box>
  );
}

function GmailInfoPanel({ t }: { t: GmailPageT }): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box
      sx={{
        borderRadius: tokens.radius.lg,
        border: `1px solid ${c.ink150}`,
        bgcolor: 'background.paper',
        p: 2,
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
        height: 'fit-content',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ mt: 0.5, color: 'primary.main' }}>
          <CheckCircle2 style={{ height: 20, width: 20 }} />
        </Box>
        <Box>
          <Typography style={{ fontWeight: 600, color: c.ink900, marginBottom: 8 }}>
            {t.info.title.value}
          </Typography>
          <Stack spacing={1}>
            <Typography style={{ fontSize: 14, color: c.ink700 }}>{t.info.step1.value}</Typography>
            <Typography style={{ fontSize: 14, color: c.ink700 }}>{t.info.step2.value}</Typography>
            <Typography style={{ fontSize: 14, color: c.ink700 }}>{t.info.step3.value}</Typography>
            <Typography style={{ fontSize: 14, color: c.ink700 }}>{t.info.step4.value}</Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

type GmailSettingsPanelProps = {
  status: GmailStatus;
  t: GmailPageT;
  isSaving: boolean;
  userLocale: string | undefined;
  onUpdateSettings: (payload: Partial<GmailSettings>) => Promise<void>;
};

// eslint-disable-next-line max-lines-per-function
function GmailSettingsPanel({
  status,
  t,
  isSaving,
  userLocale,
  onUpdateSettings,
}: GmailSettingsPanelProps): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box
      sx={{
        borderRadius: tokens.radius.lg,
        border: `1px solid ${c.ink150}`,
        bgcolor: 'background.paper',
        p: 3,
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      }}
    >
      <Typography style={{ fontSize: 18, fontWeight: 600, color: c.ink900, marginBottom: 24 }}>
        {t.settings.title.value}
      </Typography>

      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Stack spacing={0.5}>
            <Typography style={{ fontSize: 14, color: c.ink500 }}>
              {t.settings.labelName.value}
            </Typography>
            <Typography style={{ fontWeight: 500, color: c.ink900 }}>
              {status.settings?.labelName || 'Lumio/Receipts'}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography style={{ fontSize: 14, color: c.ink500 }}>
              {t.settings.lastSync.value}
            </Typography>
            <Typography style={{ fontWeight: 500, color: c.ink900 }}>
              {formatDateTime(status.settings?.lastSyncAt, userLocale) ||
                t.common.unknownDate.value}
            </Typography>
          </Stack>
        </Box>

        <Stack spacing={1}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={status.settings?.filterEnabled ?? true}
              onCheckedChange={checked =>
                void onUpdateSettings({ filterEnabled: checked as boolean })
              }
              disabled={isSaving}
            />
            <Typography style={{ fontSize: 14, color: c.ink800 }}>
              {t.settings.filterEnabled.value}
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={0.5}>
          <Typography style={{ fontSize: 14, color: c.ink500 }}>
            {t.settings.watchStatus.value}
          </Typography>
          <Typography style={{ fontWeight: 500, color: c.ink900 }}>
            {status.settings?.watchEnabled ? (
              <span style={{ color: c.success }}>{t.status.active.value}</span>
            ) : (
              <span style={{ color: c.ink400 }}>{t.status.inactive.value}</span>
            )}
          </Typography>
          {status.settings?.watchExpiration && (
            <Typography style={{ fontSize: 12, color: c.ink500 }}>
              {t.settings.expires.value}:{' '}
              {formatDateTime(status.settings.watchExpiration, userLocale)}
            </Typography>
          )}
        </Stack>

        <Stack spacing={1}>
          <label htmlFor="gmail-filter-keywords" style={{ fontSize: 14, color: c.ink500 }}>
            {t.settings.keywords.value}
          </label>
          <input
            id="gmail-filter-keywords"
            type="text"
            value={status.settings?.filterConfig?.keywords?.join(', ') || ''}
            onChange={e =>
              void onUpdateSettings({
                filterConfig: {
                  ...status.settings?.filterConfig,
                  keywords: e.target.value.split(',').map(k => k.trim()),
                },
              })
            }
            disabled={isSaving}
            placeholder={t.settings.keywordsPlaceholder.value}
            style={{
              width: '100%',
              border: `1px solid ${c.ink150}`,
              borderRadius: tokens.radius.md,
              padding: '8px 12px',
              fontSize: 14,
              color: c.ink900,
            }}
          />
          <Typography style={{ fontSize: 12, color: c.ink500 }}>
            {t.settings.keywordsHelp.value}
          </Typography>
        </Stack>

        <Stack spacing={1}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={status.settings?.filterConfig?.hasAttachment ?? true}
              onCheckedChange={checked =>
                void onUpdateSettings({
                  filterConfig: {
                    ...status.settings?.filterConfig,
                    hasAttachment: checked as boolean,
                  },
                })
              }
              disabled={isSaving}
            />
            <Typography style={{ fontSize: 14, color: c.ink800 }}>
              {t.settings.hasAttachment.value}
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}

// eslint-disable-next-line max-lines-per-function
export default function GmailIntegrationPage(): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const { user, loading: authLoading } = useAuth();
  const t = useIntlayer('gmailIntegrationPage');
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailSaving, setGmailSaving] = useState(false);

  const handleCallbackError = useCallback(
    (reason?: string) => {
      toast.error(reason ? `${t.errors.authFailed.value}: ${reason}` : t.errors.authFailed.value);
    },
    [t],
  );

  const messages = useMemo(
    () => ({
      errors: {
        loadStatus: t.errors.loadStatus.value,
        connectFailed: t.errors.connectFailed.value,
        disconnectFailed: t.errors.disconnectFailed.value,
        syncFailed: t.errors.syncFailed.value,
      },
      toasts: {
        connected: t.toasts.connected.value,
        connecting: t.toasts.connecting.value,
        disconnected: t.toasts.disconnected.value,
        syncStarted: t.toasts.syncStarted.value,
      },
      successCallbackParam: 'success' as const,
      onCallbackError: handleCallbackError,
    }),
    [t, handleCallbackError],
  );

  const {
    status: baseStatus,
    loading,
    saving,
    loadStatus,
    handleConnect,
    handleDisconnect,
  } = useIntegrationStatus({ apiPath: 'gmail', user, messages });

  const status = baseStatus as GmailStatus | null;

  const updateSettings = async (payload: Partial<GmailSettings>): Promise<void> => {
    await (async () => {
      setGmailSaving(true);
      await apiClient.post('/integrations/gmail/settings', payload);
      toast.success(t.toasts.settingsSaved.value);
      await loadStatus();
    })()
      .catch(async () => {
        toast.error(t.errors.saveFailed.value);
      })
      .finally(async () => {
        setGmailSaving(false);
      });
  };

  const handleGmailSync = async (): Promise<void> => {
    await (async () => {
      setGmailSyncing(true);
      const response = await apiClient.post('/integrations/gmail/sync');
      const messagesFound = Number(response.data?.messagesFound ?? 0);
      const jobsCreated = Number(response.data?.jobsCreated ?? 0);
      const skipped = Number(response.data?.skipped ?? 0);
      if (jobsCreated > 0) {
        toast.success(`${t.toasts.syncStarted.value} (${jobsCreated})`);
      } else if (messagesFound === 0) {
        toast.error(t.errors.noMatches.value);
      } else if (messagesFound > 0 && skipped >= messagesFound) {
        toast.error(t.errors.allSynced.value);
      } else {
        toast.error(t.errors.syncNoNew.value);
      }
      await loadStatus();
    })()
      .catch(async () => {
        toast.error(t.errors.syncFailed.value);
      })
      .finally(async () => {
        setGmailSyncing(false);
      });
  };

  const isSaving = saving || gmailSaving;
  const statusLabel = useMemo(() => {
    if (!status) return '';
    if (status.status === 'needs_reauth') return t.status.needsReauth.value;
    if (status.connected) return t.status.connected.value;
    return t.status.disconnected.value;
  }, [status, t]);

  if (authLoading) return <GmailLoadingView />;
  if (!user) return <GmailNotLoggedInView t={t} />;

  return (
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pt: 'var(--lumio-page-top, 40px)', pb: 5 }}>
      {loading && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography style={{ fontSize: 14, color: c.ink500 }}>
            {t.common.loading.value}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2 }}>
        <Stack spacing={2}>
          <IntegrationStatusCard
            status={status}
            title={t.header.title.value}
            statusLabel={statusLabel}
            saving={isSaving}
            syncing={gmailSyncing}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSync={handleGmailSync}
            connectLabel={t.actions.connect.value}
            reconnectLabel={t.actions.reconnect.value}
            syncLabel={t.actions.sync.value}
            disconnectLabel={t.actions.disconnect.value}
            disconnectedHint="We'll create a label in your Gmail and sync new receipts automatically."
          />
          {status?.connected && (
            <GmailSettingsPanel
              status={status}
              t={t}
              isSaving={isSaving}
              userLocale={user?.locale}
              onUpdateSettings={updateSettings}
            />
          )}
        </Stack>
        <GmailInfoPanel t={t} />
      </Box>
    </Box>
  );
}
