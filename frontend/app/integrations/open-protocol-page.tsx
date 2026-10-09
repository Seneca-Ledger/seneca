'use client';

import { Box, Stack, Typography } from '@mui/material';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';

type ProtocolStatus = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'needs_reauth';
  source?: 'personal' | 'workspace' | 'env' | 'disabled';
  settings?: Record<string, string | number | boolean | null | undefined>;
};

type ProtocolFile = {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  modifiedAt: string | null;
};

export type ProtocolIntegrationPageProps = {
  title: string;
  description: string;
  statusPath: string;
  settingsPath: string;
  settingsMethod?: 'post' | 'put';
  disconnectPath: string;
  fields: ConfigField[];
  presets?: ConfigPreset[];
  workflow: string;
  icon?: React.ReactNode;
  filesPath?: string;
  importPath?: string;
  syncPath?: string;
  embedded?: boolean;
  onConnectionStatusChange?: (connected: boolean) => void | Promise<void>;
};

/** One-click fill for the fields above — a known provider's endpoint and model. */
export type ConfigPreset = {
  label: string;
  values: Record<string, string | number | boolean>;
};

export type ConfigField = {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'number' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  browseAction?: {
    label: string;
    endpoint: string;
    dependsOn: string[];
  };
};

export function ProtocolIntegrationPage({
  statusPath,
  settingsPath,
  settingsMethod = 'post',
  disconnectPath,
  fields,
  presets,
  workflow,
  filesPath,
  importPath,
  syncPath,
  embedded = false,
  onConnectionStatusChange,
}: ProtocolIntegrationPageProps): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const t = useIntlayer('protocolIntegrationPage');
  const [status, setStatus] = useState<ProtocolStatus | null>(null);
  const [files, setFiles] = useState<ProtocolFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [browseOptions, setBrowseOptions] = useState<Record<string, string[]>>({});
  const [browsing, setBrowsing] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    apiClient
      .get<ProtocolStatus>(statusPath)
      .then(response => {
        if (mounted) {
          setStatus(response.data);
          setForm(buildInitialForm(fields, response.data.settings || {}));
          void onConnectionStatusChange?.(Boolean(response.data.connected));
        }
      })
      .catch(() => {
        if (mounted) {
          setStatus({ connected: false, status: 'disconnected', settings: {} });
          setForm(buildInitialForm(fields, {}));
        }
      });

    return () => {
      mounted = false;
    };
  }, [fields, onConnectionStatusChange, statusPath]);

  const connected = Boolean(status?.connected);
  const canDisconnect = connected && status?.source !== 'env';

  const saveSettings = async (): Promise<void> => {
    setSaving(true);
    setActionMessage(null);

    await (async () => {
      const response =
        settingsMethod === 'put'
          ? await apiClient.put<ProtocolStatus>(settingsPath, form)
          : await apiClient.post<ProtocolStatus>(settingsPath, form);
      setStatus(response.data);
      setForm(buildInitialForm(fields, response.data.settings || {}));
      void onConnectionStatusChange?.(Boolean(response.data.connected));
      setActionMessage(t.messages.connected.value);
    })()
      .catch(async () => {
        setActionMessage(t.messages.connectionFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const disconnect = async (): Promise<void> => {
    setSaving(true);
    setActionMessage(null);

    await (async () => {
      await apiClient.delete(disconnectPath);
      const response = await apiClient.get<ProtocolStatus>(statusPath);
      setStatus(response.data);
      void onConnectionStatusChange?.(Boolean(response.data.connected));
      setActionMessage(t.messages.disconnected.value);
    })()
      .catch(async () => {
        setActionMessage(t.messages.disconnectFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const loadFiles = async (): Promise<void> => {
    if (!filesPath) return;
    setLoadingFiles(true);
    setActionMessage(null);

    await (async () => {
      const response = await apiClient.get<{ files: ProtocolFile[] }>(filesPath);
      setFiles(response.data.files || []);
    })()
      .catch(async () => {
        setActionMessage(t.messages.loadFilesFailed.value);
      })
      .finally(async () => {
        setLoadingFiles(false);
      });
  };

  const importFile = async (file: ProtocolFile): Promise<void> => {
    if (!importPath) return;
    setActionMessage(null);

    await (async () => {
      await apiClient.post(importPath, { fileIds: [file.id] });
      setActionMessage(t.messages.imported.value.replace('{name}', file.name));
    })().catch(async () => {
      setActionMessage(t.messages.importFailed.value.replace('{name}', file.name));
    });
  };

  const browseField = async (field: ConfigField): Promise<void> => {
    const browseAction = field.browseAction;
    if (!browseAction) return;
    setBrowsing(field.name);

    await (async () => {
      const body = Object.fromEntries(browseAction.dependsOn.map(key => [key, form[key]]));
      const response = await apiClient.post<string[]>(browseAction.endpoint, body);
      setBrowseOptions(prev => ({ ...prev, [field.name]: response.data }));
    })()
      .catch(async () => {
        setActionMessage(t.messages.browseFailed.value);
      })
      .finally(async () => {
        setBrowsing(null);
      });
  };

  const syncNow = async (): Promise<void> => {
    if (!syncPath) return;
    setActionMessage(null);

    await (async () => {
      const response = await apiClient.post<{ uploaded?: number; imported?: number }>(syncPath);
      const count = response.data.uploaded ?? response.data.imported ?? 0;
      setActionMessage(t.messages.syncComplete.value.replace('{count}', String(count)));
    })().catch(async () => {
      setActionMessage(t.messages.syncFailed.value);
    });
  };

  return (
    <Box
      sx={{
        maxWidth: 960,
        mx: 'auto',
        px: embedded ? 0 : { xs: 2, md: 4 },
        py: embedded ? 0 : { xs: 3, md: 5 },
      }}
    >
      <Stack spacing={3}>
        <Box
          sx={{
            border: `1px solid ${c.ink150}`,
            borderRadius: tokens.radius.md,
            bgcolor: c.surface,
            p: 3,
          }}
        >
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ color: c.ink900, fontSize: 18, fontWeight: 650 }}>
                {t.status}
              </Typography>
              <Typography
                sx={{
                  color: connected ? c.success : c.ink600,
                  fontSize: 13,
                  fontWeight: 650,
                  textTransform: 'uppercase',
                }}
              >
                {connected ? t.configured : t.notConfigured}
              </Typography>
            </Box>
            <Typography sx={{ color: c.ink600, fontSize: 14, lineHeight: 1.6 }}>
              {workflow}
            </Typography>
          </Stack>
        </Box>

        <Box
          sx={{
            border: `1px solid ${c.ink150}`,
            borderRadius: tokens.radius.md,
            bgcolor: c.surface,
            p: 3,
          }}
        >
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ color: c.ink900, fontSize: 18, fontWeight: 650 }}>
                {t.connection}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={saving}
                  style={buttonStyle(c.primary, c.surface)}
                >
                  {saving ? t.checking : connected ? t.updateConnection : t.connect}
                </button>
                {canDisconnect && (
                  <button
                    type="button"
                    onClick={() => void disconnect()}
                    disabled={saving}
                    style={buttonStyle(c.ink800, c.surface, c.ink150)}
                  >
                    {t.disconnect}
                  </button>
                )}
              </Box>
            </Box>

            {presets?.length ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography sx={{ color: c.ink600, fontSize: 13, fontWeight: 600 }}>
                  {t.presets}
                </Typography>
                {presets.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, ...preset.values }))}
                    style={buttonStyle(c.ink800, c.surface, c.ink150)}
                  >
                    {preset.label}
                  </button>
                ))}
              </Box>
            ) : null}

            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}
            >
              {fields.map(field => (
                <label key={field.name} style={{ display: 'grid', gap: 6 }}>
                  <Typography sx={{ color: c.ink700, fontSize: 13, fontWeight: 600 }}>
                    {field.label}
                  </Typography>
                  {field.type === 'checkbox' ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 38 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(form[field.name])}
                        onChange={event =>
                          setForm(prev => ({ ...prev, [field.name]: event.target.checked }))
                        }
                      />
                    </Box>
                  ) : field.browseAction ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {browseOptions[field.name]?.length ? (
                        <Select
                          value={String(form[field.name] ?? '')}
                          onChange={value => setForm(prev => ({ ...prev, [field.name]: value }))}
                          options={browseOptions[field.name].map(opt => ({
                            value: opt,
                            label: opt,
                          }))}
                          sx={{ flex: 1, backgroundColor: c.surface, color: c.ink900 }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(form[field.name] ?? '')}
                          placeholder={field.placeholder}
                          onChange={event =>
                            setForm(prev => ({ ...prev, [field.name]: event.target.value }))
                          }
                          style={{ ...inputStyle(c), flex: 1 }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => void browseField(field)}
                        disabled={browsing === field.name}
                        style={buttonStyle(c.ink800, c.surface, c.ink150)}
                      >
                        {browsing === field.name ? '...' : field.browseAction.label}
                      </button>
                    </Box>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={String(form[field.name] ?? '')}
                      placeholder={field.placeholder}
                      required={field.required}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          [field.name]:
                            field.type === 'number'
                              ? Number(event.target.value)
                              : event.target.value,
                        }))
                      }
                      style={inputStyle(c)}
                    />
                  )}
                </label>
              ))}
            </Box>
            {actionMessage && (
              <Typography sx={{ color: c.ink600, fontSize: 14 }}>{actionMessage}</Typography>
            )}
          </Stack>
        </Box>

        {(filesPath || syncPath) && (
          <Box
            sx={{
              border: `1px solid ${c.ink150}`,
              borderRadius: tokens.radius.md,
              bgcolor: c.surface,
              p: 3,
            }}
          >
            <Stack spacing={2}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <Typography sx={{ color: c.ink900, fontSize: 18, fontWeight: 650 }}>
                  {t.actions}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {filesPath && (
                    <button
                      type="button"
                      onClick={() => void loadFiles()}
                      disabled={!connected || loadingFiles}
                      style={buttonStyle(c.primary, c.surface)}
                    >
                      {loadingFiles ? t.loading : t.browseFiles}
                    </button>
                  )}
                  {syncPath && (
                    <button
                      type="button"
                      onClick={() => void syncNow()}
                      disabled={!connected}
                      style={buttonStyle(c.ink800, c.surface, c.ink150)}
                    >
                      {t.syncNow}
                    </button>
                  )}
                </Box>
              </Box>

              {files.length > 0 && (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {files.map(file => (
                    <Box
                      key={file.id}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
                        gap: 1.5,
                        alignItems: 'center',
                        border: `1px solid ${c.ink150}`,
                        borderRadius: tokens.radius.sm,
                        px: 1.5,
                        py: 1,
                      }}
                    >
                      <Stack spacing={0.25}>
                        <Typography sx={{ color: c.ink900, fontSize: 14, fontWeight: 600 }}>
                          {file.name}
                        </Typography>
                        <Typography sx={{ color: c.ink500, fontSize: 12 }}>
                          {formatBytes(file.size)} · {file.mimeType}
                        </Typography>
                      </Stack>
                      {importPath && (
                        <button
                          type="button"
                          onClick={() => void importFile(file)}
                          style={buttonStyle(c.primary, c.surface)}
                        >
                          {t.import}
                        </button>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function buildInitialForm(
  fields: ConfigField[],
  settings: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  const next: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    const value = settings[field.name];
    if (field.type === 'checkbox') {
      next[field.name] = typeof value === 'boolean' ? value : true;
    } else if (field.type === 'password') {
      next[field.name] = '';
    } else {
      next[field.name] = value ?? '';
    }
  }
  return next;
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function buttonStyle(color: string, background: string, border?: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    border: `1px solid ${border || color}`,
    borderRadius: tokens.radius.md,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 650,
    color,
    background,
    cursor: 'pointer',
  };
}

function inputStyle(c: { ink150: string; ink900: string; surface: string }): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 38,
    border: `1px solid ${c.ink150}`,
    borderRadius: tokens.radius.sm,
    padding: '8px 10px',
    fontSize: 14,
    color: c.ink900,
    background: c.surface,
  };
}
