/* eslint-disable max-lines */
'use client';

import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Spinner } from '@/app/components/ui/spinner';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { formatDateTime } from '@/app/lib/format-datetime';
import { getPickerDocName, pickDriveFolder } from '@/app/lib/googleDrivePicker';
import { tokens } from '@/lib/theme-tokens';
import { IntegrationStatusCard } from '../components/IntegrationStatusCard';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';

type DriveSettings = {
  folderId?: string | null;
  folderName?: string | null;
  syncEnabled?: boolean;
  syncTime?: string;
  timeZone?: string | null;
  lastSyncAt?: string | null;
};

type DriveStatus = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'needs_reauth';
  settings?: DriveSettings | null;
};

type DrivePageT = ReturnType<typeof useIntlayer<'googleDriveIntegrationPage'>>;

function DriveLoadingView(): React.JSX.Element {
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

function DriveNotLoggedInView({ t }: { t: DrivePageT }): React.JSX.Element {
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
          {t.status.disconnected.value}
        </Typography>
        <Typography style={{ fontSize: 14, color: c.ink700 }}>{t.header.subtitle}</Typography>
      </Box>
    </Box>
  );
}

type DriveSettingsPanelProps = {
  status: DriveStatus;
  t: DrivePageT;
  saving: boolean;
  userLocale: string | undefined;
  onPickFolder: () => Promise<void>;
  onUpdateSettings: (payload: Partial<DriveSettings>) => Promise<void>;
};

// eslint-disable-next-line max-lines-per-function
function DriveSettingsPanel({
  status,
  t,
  saving,
  userLocale,
  onPickFolder,
  onUpdateSettings,
}: DriveSettingsPanelProps): React.JSX.Element {
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography style={{ fontSize: 18, fontWeight: 600, color: c.ink900 }}>
          {t.settings.title}
        </Typography>
        <button
          type="button"
          onClick={onPickFolder}
          disabled={!status?.connected || saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid var(--color-primary)',
            borderRadius: tokens.radius.md,
            padding: '6px 16px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-primary)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          {t.actions.pickFolder}
        </button>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Stack spacing={0.5}>
          <Typography style={{ fontSize: 14, color: c.ink500 }}>{t.settings.folder}</Typography>
          <Typography style={{ fontWeight: 500, color: c.ink900 }}>
            {status?.settings?.folderName ||
              status?.settings?.folderId ||
              t.settings.folderPlaceholder}
          </Typography>
        </Stack>
        <Stack spacing={0.5}>
          <Typography style={{ fontSize: 14, color: c.ink500 }}>{t.settings.lastSync}</Typography>
          <Typography style={{ fontWeight: 500, color: c.ink900 }}>
            {formatDateTime(status?.settings?.lastSyncAt, userLocale) || '—'}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography style={{ fontSize: 14, color: c.ink500 }}>
            {t.settings.syncEnabled}
          </Typography>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={status?.settings?.syncEnabled ?? true}
              onCheckedChange={checked =>
                void onUpdateSettings({ syncEnabled: checked as boolean })
              }
              disabled={!status?.connected || saving}
            />
            <Typography style={{ fontSize: 14, color: c.ink800 }}>
              {status?.settings?.syncEnabled ? t.status.connected : t.status.disconnected}
            </Typography>
          </Box>
        </Stack>
        <Stack spacing={1}>
          <Typography style={{ fontSize: 14, color: c.ink500 }}>{t.settings.syncTime}</Typography>
          <input
            type="time"
            value={status?.settings?.syncTime || '03:00'}
            onChange={e => void onUpdateSettings({ syncTime: e.target.value })}
            disabled={!status?.connected || saving}
            style={{
              width: '100%',
              border: `1px solid ${c.ink150}`,
              borderRadius: tokens.radius.md,
              padding: '8px 12px',
              fontSize: 14,
              color: c.ink900,
            }}
          />
        </Stack>
        <Stack spacing={0.5}>
          <Typography style={{ fontSize: 14, color: c.ink500 }}>{t.settings.timeZone}</Typography>
          <Typography style={{ fontWeight: 500, color: c.ink900 }}>
            {status?.settings?.timeZone || 'UTC'}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function DriveInfoPanel({ t }: { t: DrivePageT }): React.JSX.Element {
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
        height: 'fit-content',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <AlertCircle
          style={{ height: 20, width: 20, color: 'var(--color-primary)', marginTop: 4 }}
        />
        <Stack spacing={1}>
          <Typography style={{ fontSize: 14, color: c.ink700 }}>
            {t.settings.syncEnabled}
          </Typography>
          <Typography style={{ fontSize: 14, color: c.ink700 }}>
            {t.settings.folderPlaceholder}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

// eslint-disable-next-line max-lines-per-function
export default function GoogleDriveIntegrationPage(): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const { user, loading: authLoading } = useAuth();
  const t = useIntlayer('googleDriveIntegrationPage');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY || '';

  const messages = useMemo(
    () => ({
      errors: {
        loadStatus: t.errors.loadStatus.value,
        connectFailed: t.errors.connectFailed.value,
        disconnectFailed: t.errors.disconnectFailed.value,
        syncFailed: 'Sync failed',
      },
      toasts: {
        connected: t.toasts.connected.value,
        connecting: t.toasts.connecting.value,
        disconnected: t.toasts.disconnected.value,
        syncStarted: t.toasts.syncStarted.value,
      },
    }),
    [t],
  );

  const {
    status: baseStatus,
    loading,
    saving,
    syncing,
    loadStatus,
    handleConnect,
    handleDisconnect,
    handleSync,
  } = useIntegrationStatus({ apiPath: 'google-drive', user, messages });

  const status = baseStatus as DriveStatus | null;

  const updateSettings = async (payload: Partial<DriveSettings>): Promise<void> => {
    await (async () => {
      await apiClient.post('/integrations/google-drive/settings', payload);
      toast.success(t.toasts.settingsSaved.value);
      await loadStatus();
    })().catch(async () => {
      toast.error(t.errors.connectFailed.value);
    });
  };

  const handlePickFolder = async (): Promise<void> => {
    if (!apiKey) {
      toast.error(t.errors.pickerUnavailable.value);
      return;
    }

    return await (async () => {
      const tokenResp = await apiClient.get('/integrations/google-drive/picker-token');
      const accessToken = tokenResp.data?.accessToken as string | undefined;
      if (!accessToken) {
        toast.error(t.errors.pickerUnavailable.value);
        return;
      }
      const folder = await pickDriveFolder({ accessToken, apiKey });
      if (!folder) return;
      await updateSettings({ folderId: folder.id, folderName: getPickerDocName(folder) });
    })().catch(async () => {
      toast.error(t.errors.pickerUnavailable.value);
    });
  };

  const statusLabel = useMemo(() => {
    if (!status) return '';
    if (status.status === 'needs_reauth') return t.status.needsReauth.value;
    if (status.connected) return t.status.connected.value;
    return t.status.disconnected.value;
  }, [status, t]);

  if (authLoading) return <DriveLoadingView />;
  if (!user) return <DriveNotLoggedInView t={t} />;

  return (
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pt: 'var(--lumio-page-top, 40px)', pb: 5 }}>
      {loading && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography style={{ fontSize: 14, color: c.ink500 }}>{t.loading}</Typography>
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2 }}>
        <Stack spacing={2}>
          <IntegrationStatusCard
            status={status}
            title={t.header.title}
            statusLabel={statusLabel}
            saving={saving}
            syncing={syncing}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
            connectLabel={t.actions.connect}
            reconnectLabel={t.actions.reconnect}
            syncLabel={t.actions.syncNow}
            disconnectLabel={t.actions.disconnect}
            disconnectedHint="We'll create a folder in your Google Drive and sync files daily."
          />
          {status?.connected && (
            <DriveSettingsPanel
              status={status}
              t={t}
              saving={saving}
              userLocale={user?.locale}
              onPickFolder={handlePickFolder}
              onUpdateSettings={updateSettings}
            />
          )}
        </Stack>
        {status?.connected && <DriveInfoPanel t={t} />}
      </Box>
    </Box>
  );
}
