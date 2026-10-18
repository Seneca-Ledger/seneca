'use client';

import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Box, Stack, Typography } from '@mui/material';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { LocalCategorizationStatus, LocalCategorizationTestResult } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';

type MessageKey =
  | 'loadFailed'
  | 'saved'
  | 'saveFailed'
  | 'modelInstalled'
  | 'installFailed'
  | 'testFailed';

const DEFAULT_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
// Starter values for an editable field, not UI copy: the user replaces them
// and the embedding model is multilingual, so they are plain defaults.
const DEFAULT_CATEGORIES = ['Groceries', 'Transport', 'Entertainment', 'Health', 'Utilities'];

export function LocalCategorizationPanel(): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const t = useIntlayer('localCategorizationPanel');
  const [status, setStatus] = useState<LocalCategorizationStatus | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [threshold, setThreshold] = useState(0.35);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES.join('\n'));
  const [merchantName, setMerchantName] = useState('Fresh Market');
  const [testResult, setTestResult] = useState<LocalCategorizationTestResult | null>(null);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);

  const applyStatus = (next: LocalCategorizationStatus): void => {
    setStatus(next);
    setEnabled(next.settings?.enabled ?? true);
    setModelId(next.settings?.modelId || DEFAULT_MODEL_ID);
    setThreshold(Number(next.settings?.threshold ?? 0.35));
  };

  useEffect(() => {
    let mounted = true;

    apiQueryDecoded({
      url: '/settings/local-categorization',
      contract: 'LocalCategorizationStatus',
    })
      .then(status => {
        if (!mounted) {
          return;
        }
        applyStatus(status);
      })
      .catch(() => {
        if (mounted) {
          setMessage('loadFailed');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const saveSettings = async (): Promise<void> => {
    setSaving(true);
    setMessage(null);

    await (async () => {
      const response = await apiClient.put('/settings/local-categorization', {
        enabled,
        modelId,
        threshold,
      } satisfies ContractInput<'SaveLocalCategorizationBody'>);
      applyStatus(
        await checkContract(
          'LocalCategorizationStatus',
          response.data,
          '/settings/local-categorization',
        ),
      );
      setMessage('saved');
    })()
      .catch(async () => {
        setMessage('saveFailed');
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const uploadModel = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }
    setUploading(true);
    setMessage(null);

    await (async () => {
      const formData = new FormData();
      formData.append('model', file);
      const response = await apiClient.post('/settings/local-categorization/model', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      applyStatus(
        await checkContract(
          'LocalCategorizationStatus',
          response.data,
          '/settings/local-categorization/model',
        ),
      );
      setMessage('modelInstalled');
    })()
      .catch(async () => {
        setMessage('installFailed');
      })
      .finally(async () => {
        setUploading(false);
      });
  };

  const testMerchant = async (): Promise<void> => {
    setTesting(true);
    setMessage(null);

    await (async () => {
      const response = await apiClient.post('/settings/local-categorization/test', {
        merchantName,
        categories: splitCategories(categories),
      } satisfies ContractInput<'TestLocalCategorizationBody'>);
      setTestResult(
        await checkContract(
          'LocalCategorizationTestResult',
          response.data,
          '/settings/local-categorization/test',
        ),
      );
    })()
      .catch(async () => {
        setMessage('testFailed');
      })
      .finally(async () => {
        setTesting(false);
      });
  };

  const modelInstalled = Boolean(status?.settings?.modelInstalled);
  const statusLabel = modelInstalled ? t.modelReady : t.modelMissing;

  return (
    <Stack spacing={2}>
      <Panel>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ color: c.ink900, fontSize: 18, fontWeight: 650 }}>
              {t.status}
            </Typography>
            <Typography
              sx={{
                color: modelInstalled ? c.success : c.ink600,
                fontSize: 13,
                fontWeight: 650,
                textTransform: 'uppercase',
              }}
            >
              {statusLabel}
            </Typography>
          </Box>
          <Typography sx={{ color: c.ink600, fontSize: 14, lineHeight: 1.6 }}>
            {t.runsLocally}
          </Typography>
          {status?.settings?.localModelPath ? (
            <Typography sx={{ color: c.ink500, fontSize: 12 }}>
              {t.installedPath.value.replace('{path}', status.settings.localModelPath)}
            </Typography>
          ) : null}
        </Stack>
      </Panel>

      <Panel>
        <Stack spacing={2}>
          <SectionHeader title={t.settings}>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={saving}
              style={buttonStyle(c.primary, c.surface)}
            >
              {saving ? t.saving : t.saveSettings}
            </button>
          </SectionHeader>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 160px' },
              gap: 1.5,
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <Typography sx={labelSx(c)}>{t.model}</Typography>
              <input
                name="modelId"
                value={modelId}
                onChange={event => setModelId(event.target.value)}
                style={inputStyle(c)}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <Typography sx={labelSx(c)}>{t.threshold}</Typography>
              <input
                name="threshold"
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                value={threshold}
                onChange={event => setThreshold(Number(event.target.value))}
                style={inputStyle(c)}
              />
            </label>
          </Box>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={event => setEnabled(event.target.checked)}
            />
            <Typography sx={{ color: c.ink700, fontSize: 14 }}>{t.enable}</Typography>
          </label>
        </Stack>
      </Panel>

      <Panel>
        <Stack spacing={2}>
          <SectionHeader title={t.modelArchive}>
            <label style={buttonStyle(c.primary, c.surface)}>
              <UploadFileOutlinedIcon sx={{ fontSize: 16, mr: 0.75 }} aria-hidden="true" />
              {uploading ? t.installing : t.uploadZip}
              <input
                type="file"
                accept=".zip,application/zip"
                disabled={uploading}
                onChange={event => void uploadModel(event.target.files?.[0])}
                style={{ display: 'none' }}
              />
            </label>
          </SectionHeader>
          <Typography sx={{ color: c.ink600, fontSize: 14, lineHeight: 1.6 }}>
            {t.uploadHint}
          </Typography>
        </Stack>
      </Panel>

      <Panel>
        <Stack spacing={2}>
          <SectionHeader title={t.testMerchant}>
            <button
              type="button"
              onClick={() => void testMerchant()}
              disabled={testing}
              style={buttonStyle(c.primary, c.surface)}
            >
              {testing ? t.testing : t.testMerchant}
            </button>
          </SectionHeader>

          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <Typography sx={labelSx(c)}>{t.merchantName}</Typography>
              <input
                name="merchantName"
                value={merchantName}
                onChange={event => setMerchantName(event.target.value)}
                style={inputStyle(c)}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <Typography sx={labelSx(c)}>{t.categories}</Typography>
              <textarea
                value={categories}
                onChange={event => setCategories(event.target.value)}
                rows={5}
                style={{ ...inputStyle(c), resize: 'vertical' }}
              />
            </label>
          </Box>

          {testResult ? (
            <Box
              sx={{
                border: `1px solid ${c.ink150}`,
                borderRadius: tokens.radius.sm,
                px: 1.5,
                py: 1,
                color: c.ink800,
                fontSize: 14,
              }}
            >
              {t.result.value.replace('{category}', testResult.category ?? t.notDetermined.value)}
              {testResult.modelLoadError ? ` (${testResult.modelLoadError})` : ''}
            </Box>
          ) : null}

          {message ? (
            <Typography sx={{ color: c.ink600, fontSize: 14 }}>{t.messages[message]}</Typography>
          ) : null}
        </Stack>
      </Panel>
    </Stack>
  );
}

function Panel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 3,
      }}
    >
      {children}
    </Box>
  );
}

function SectionHeader({
  children,
  title,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Typography sx={{ fontSize: 18, fontWeight: 650 }}>{title}</Typography>
      {children}
    </Box>
  );
}

function splitCategories(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function labelSx(c: { ink700: string }) {
  return { color: c.ink700, fontSize: 13, fontWeight: 600 };
}

function buttonStyle(color: string, background: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    border: `1px solid ${color}`,
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
