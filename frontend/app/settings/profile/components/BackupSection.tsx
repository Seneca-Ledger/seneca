'use client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, Download, FileUp, Lock, RefreshCw } from '@/app/components/icons';
import { Alert } from '@/app/components/ui/alert';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import { APP_SLUG } from '@/app/lib/brand';
import type { BackupImportPreview } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { formatStoredDateTime } from '@/app/lib/user-format-store';

type BackupConfig = {
  destinationKind: 'local' | 'nextcloud';
  destinationPath: string;
  dailyTime: string;
  timeZone: string;
  retentionCount: number;
  enabled: boolean;
  lastSuccessfulAt: string | null;
  passwordConfigured: boolean;
};

type BackupRun = {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  trigger: 'manual' | 'scheduled';
  createdAt: string;
  finishedAt: string | null;
  sizeBytes: string | null;
  errorMessage: string | null;
};

const defaultConfig: BackupConfig = {
  destinationKind: 'local',
  destinationPath: `${APP_SLUG}-backups`,
  dailyTime: '03:00',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  retentionCount: 7,
  enabled: true,
  lastSuccessfulAt: null,
  passwordConfigured: false,
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This settings panel owns its related async form actions.
export function BackupSection() {
  const t = useIntlayer('settingsBackupSection');
  const [config, setConfig] = useState<BackupConfig>(defaultConfig);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [password, setPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    await (async () => {
      const [configResponse, runs] = await Promise.all([
        apiClient.get('/backups/config'),
        apiQueryDecoded({ url: '/backups/runs', contract: 'BackupRunList' }),
      ]);
      // Not set up yet: the null arrives as an empty body.
      const stored = await checkContract(
        'BackupConfiguration',
        configResponse.data || null,
        '/backups/config',
      );
      if (stored) {
        setConfig(stored);
      }
      setRuns(runs);
      setError(null);
    })()
      .catch(async () => {
        setError(t.errors.loadFailed.value);
      })
      .finally(async () => {
        setLoading(false);
      });
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (!(config.passwordConfigured || password)) {
      setError(t.errors.passwordRequired.value);
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);

    await (async () => {
      // The writable settings only: id, passwordConfigured and the last run are
      // the server's, and the API rejects fields it does not take.
      const response = await apiClient.put('/backups/config', {
        destinationKind: config.destinationKind,
        destinationPath: config.destinationPath,
        dailyTime: config.dailyTime,
        timeZone: config.timeZone,
        retentionCount: config.retentionCount,
        enabled: config.enabled,
        password: password || undefined,
      } satisfies ContractInput<'UpdateBackupConfigurationBody'>);
      const saved = await checkContract('BackupConfiguration', response.data, '/backups/config');
      if (saved) {
        setConfig(saved);
      }
      setPassword('');
      setMessage(t.messages.saved.value);
    })()
      .catch(async () => {
        setError(t.errors.saveFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const createNow = async () => {
    setRunning(true);
    setMessage(null);
    setError(null);

    await (async () => {
      await apiClient.post('/backups/runs');
      setMessage(t.messages.created.value);
      await refresh();
    })()
      .catch(async () => {
        setError(t.errors.createFailed.value);
        await refresh();
      })
      .finally(async () => {
        setRunning(false);
      });
  };

  const download = async (run: BackupRun) => {
    await (async () => {
      const response = await apiClient.get(`/backups/runs/${run.id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(blobOf(response));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_SLUG}-${run.id}.seneca-backup`;
      link.click();
      URL.revokeObjectURL(url);
    })().catch(async () => {
      setError(t.errors.downloadFailed.value);
    });
  };

  const importBackup = async (restore: boolean) => {
    if (!(importFile && importPassword)) {
      setError(t.errors.importMissing.value);
      return;
    }
    setImporting(true);
    setError(null);

    await (async () => {
      const body = new FormData();
      body.append('file', importFile);
      body.append('password', importPassword);
      const response = await apiClient.post(
        restore ? `/backups/imports/${preview?.importId}/restore` : '/backups/import/preview',
        body,
      );
      if (restore) {
        const restored = await checkContract(
          'BackupRestoreResult',
          response.data,
          '/backups/imports/:id/restore',
        );
        setMessage(t.messages.restored.value.replace('{name}', restored.workspaceName));
        setPreview(null);
        setImportFile(null);
        setImportPassword('');
      } else {
        setPreview(
          await checkContract('BackupImportPreview', response.data, '/backups/import/preview'),
        );
      }
    })()
      .catch(async () => {
        setError(t.errors.verifyFailed.value);
      })
      .finally(async () => {
        setImporting(false);
      });
  };

  return (
    <Stack spacing={2.5}>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                alignItems: 'flex-start',
              }}
            >
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  {t.title.value}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mt: 0.5,
                    maxWidth: 680,
                  }}
                >
                  {t.intro.value}
                </Typography>
              </Box>
              <Button
                aria-label={t.refreshAria.value}
                onClick={() => void refresh()}
                disabled={loading}
                size="small"
                startIcon={<RefreshCw size={16} />}
              >
                {t.refresh.value}
              </Button>
            </Box>

            {loading ? (
              <Spinner size={20} />
            ) : (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    select
                    fullWidth
                    label={t.destination.value}
                    value={config.destinationKind}
                    onChange={event =>
                      setConfig(current => ({
                        ...current,
                        destinationKind: event.target.value as BackupConfig['destinationKind'],
                      }))
                    }
                  >
                    <MenuItem value="local">{t.destinationLocal.value}</MenuItem>
                    <MenuItem value="nextcloud">Nextcloud (WebDAV)</MenuItem>
                  </TextField>
                  <TextField
                    fullWidth
                    label={t.backupFolder.value}
                    value={config.destinationPath}
                    helperText={t.backupFolderHelp.value}
                    onChange={event =>
                      setConfig(current => ({ ...current, destinationPath: event.target.value }))
                    }
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    fullWidth
                    type="time"
                    label={t.dailyTime.value}
                    value={config.dailyTime}
                    onChange={event =>
                      setConfig(current => ({ ...current, dailyTime: event.target.value }))
                    }
                    slotProps={{
                      inputLabel: { shrink: true },
                    }}
                  />
                  <TextField
                    fullWidth
                    label={t.timeZone.value}
                    value={config.timeZone}
                    onChange={event =>
                      setConfig(current => ({ ...current, timeZone: event.target.value }))
                    }
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label={t.versionsToKeep.value}
                    value={config.retentionCount}
                    onChange={event =>
                      setConfig(current => ({
                        ...current,
                        retentionCount: Number(event.target.value) || 1,
                      }))
                    }
                    slotProps={{
                      htmlInput: { min: 1, max: 365 },
                    }}
                  />
                </Stack>
                <TextField
                  fullWidth
                  type="password"
                  label={
                    config.passwordConfigured
                      ? t.newRecoveryPassword.value
                      : t.recoveryPassword.value
                  }
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  helperText={
                    config.passwordConfigured ? t.keepPasswordHelp.value : t.requiredOnceHelp.value
                  }
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    onClick={() => void save()}
                    disabled={saving}
                    startIcon={saving ? <Spinner size={16} /> : <Lock size={16} />}
                  >
                    {t.save.value}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => void createNow()}
                    disabled={running || !config.passwordConfigured}
                    startIcon={running ? <Spinner size={16} /> : <Cloud size={16} />}
                  >
                    {t.createNow.value}
                  </Button>
                  {config.lastSuccessfulAt ? (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {t.lastSuccessful.value.replace(
                        '{date}',
                        formatStoredDateTime(config.lastSuccessfulAt),
                      )}
                    </Typography>
                  ) : null}
                </Box>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
            }}
          >
            {t.recentBackups.value}
          </Typography>
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {runs.length === 0 ? (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t.noBackups.value}
              </Typography>
            ) : (
              runs.map(run => (
                <Box
                  key={run.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    pb: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2">
                      {formatStoredDateTime(run.createdAt)} · {t.trigger[run.trigger].value}
                    </Typography>
                    {run.errorMessage ? (
                      <Typography variant="caption" color="error">
                        {run.errorMessage}
                      </Typography>
                    ) : null}
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: 'center',
                    }}
                  >
                    <Chip
                      size="small"
                      label={t.status[run.status].value}
                      color={
                        run.status === 'succeeded'
                          ? 'success'
                          : run.status === 'failed'
                            ? 'error'
                            : 'default'
                      }
                    />
                    {run.status === 'succeeded' ? (
                      <Button
                        size="small"
                        onClick={() => void download(run)}
                        startIcon={<Download size={15} />}
                      >
                        {t.download.value}
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                }}
              >
                {t.importTitle.value}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                {t.importIntro.value}
              </Typography>
            </Box>
            <input
              ref={importInput}
              type="file"
              accept=".seneca-backup,.lumio-backup,application/octet-stream"
              hidden
              onChange={event => {
                setImportFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="outlined"
                onClick={() => importInput.current?.click()}
                startIcon={<FileUp size={16} />}
              >
                {importFile?.name || t.chooseFile.value}
              </Button>
              <TextField
                fullWidth
                type="password"
                label={t.recoveryPassword.value}
                value={importPassword}
                onChange={event => setImportPassword(event.target.value)}
              />
            </Stack>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={() => void importBackup(false)}
                disabled={importing}
              >
                {t.previewImport.value}
              </Button>
              {preview ? (
                <Button
                  color="warning"
                  variant="contained"
                  onClick={() => void importBackup(true)}
                  disabled={importing}
                >
                  {importing
                    ? t.restoring.value
                    : t.restoreAs.value.replace('{name}', preview.workspaceName ?? '—')}
                </Button>
              ) : null}
            </Box>
            {preview ? (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t.verified.value
                  .replace('{name}', preview.workspaceName ?? '—')
                  .replace('{count}', String(preview.fileCount))}
              </Typography>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
