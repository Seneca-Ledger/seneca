/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useEffectEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCcw, Settings, UploadCloud } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { formatDateTime } from '@/app/lib/format-datetime';
import type { StorageStatus, StorageWidgetProvider } from '@/app/lib/storage-widget-types';
import { tokens } from '@/lib/theme-tokens';

const MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

type BaseStorageWidgetProps = {
  provider: StorageWidgetProvider;
  locale?: string;
};

type ImportResult = { status?: 'ok' | 'error'; fileId?: string };

export function BaseStorageWidget({ provider, locale }: BaseStorageWidgetProps) {
  const t = useIntlayer('storagePage');
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const pt = provider.getTranslations(t);
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const loadStatus = async (): Promise<void> => {
    await (async () => {
      setLoading(true);
      const res = await apiClient.get(`/integrations/${provider.apiPath}/status`);
      // Unchecked on purpose: Gmail, Google Drive and Dropbox are going away, so they get no contract.
      setStatus(res.data as StorageStatus);
    })()
      .catch(async () => {
        toast.error(
          pt?.errors?.loadStatus?.value || `Failed to load ${provider.providerName} status`,
        );
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  const loadStatusOnMount = useEffectEvent(() => {
    void loadStatus();
  });
  useEffect(() => {
    loadStatusOnMount();
  }, []);

  const handleConnect = async (): Promise<void> => {
    return await (async () => {
      const res = await apiClient.get(`/integrations/${provider.apiPath}/connect`);
      // Unchecked on purpose: Gmail, Google Drive and Dropbox are going away, so they get no contract.
      const url = (res.data as { url?: string } | null)?.url;
      if (!url) {
        toast.error(
          pt?.errors?.connectFailed?.value || `Failed to connect to ${provider.providerName}`,
        );
        return;
      }
      window.location.href = url;
    })().catch(async () => {
      toast.error(
        pt?.errors?.connectFailed?.value || `Failed to connect to ${provider.providerName}`,
      );
    });
  };

  const handleSyncNow = async (): Promise<void> => {
    await (async () => {
      setWorking(true);
      await apiClient.post(`/integrations/${provider.apiPath}/sync`);
      toast.success(pt?.toasts?.syncStarted?.value || 'Sync started');
      void loadStatus();
    })()
      .catch(async () => {
        toast.error(pt?.errors?.syncFailed?.value || 'Sync failed');
      })
      .finally(async () => {
        setWorking(false);
      });
  };

  // eslint-disable-next-line max-params
  const processResults = (results: ImportResult[], docs: { id: string }[]): void => {
    const ok = results.filter(r => r.status === 'ok').length;
    const bad = results.filter(r => r.status === 'error');
    if (ok > 0) {
      toast.success(
        pt?.toasts?.imported?.value?.replace('{count}', String(ok)) || `${ok} files imported`,
      );
    }
    if (bad.length > 0) {
      const names = docs
        .filter(d => bad.some(b => b.fileId === d.id))
        .map(d => provider.getDocName(d))
        .filter(Boolean)
        .join(', ');
      toast.error(
        pt?.errors?.importFailed?.value?.replace('{files}', names || provider.providerName) ||
          `Failed to import ${names || 'files'}`,
      );
    }
  };

  const handleImport = async (): Promise<void> => {
    if (!provider.isPickerAvailable()) {
      toast.error(
        pt?.errors?.pickerUnavailable?.value || `${provider.providerName} picker unavailable`,
      );
      return;
    }

    return await (async () => {
      setWorking(true);
      const docs = await provider.openPicker(MIME_TYPES);
      if (!docs.length) {
        return;
      }
      const importResp = await apiClient.post(`/integrations/${provider.apiPath}/import`, {
        fileIds: docs.map(d => d.id),
      });
      // Unchecked on purpose: Gmail, Google Drive and Dropbox are going away, so they get no contract.
      const imported = importResp.data as { results?: ImportResult[] } | null;
      processResults(Array.isArray(imported?.results) ? imported.results : [], docs);
      void loadStatus();
    })()
      .catch(async () => {
        toast.error(
          pt?.errors?.importFailed?.value?.replace('{files}', provider.providerName) ||
            'Import failed',
        );
      })
      .finally(async () => {
        setWorking(false);
      });
  };

  const statusLabel = (() => {
    if (status?.status === 'needs_reauth') {
      return String(
        pt?.status?.needsReauth?.value ?? pt?.status?.needsReauth ?? 'Needs re-authentication',
      );
    }
    if (status?.connected) {
      return String(pt?.status?.connected?.value ?? pt?.status?.connected ?? 'Connected');
    }
    return String(pt?.status?.disconnected?.value ?? pt?.status?.disconnected ?? 'Disconnected');
  })();

  const btnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: working ? 'not-allowed' : 'pointer',
    opacity: working ? 0.7 : 1,
  } as const;
  const primaryBtn = { ...btnBase, background: c.primaryFill, color: '#fff', border: 'none' };
  const outlineBtn = {
    ...btnBase,
    background: 'transparent',
    color: c.primary,
    border: `1px solid ${c.primary}`,
  };

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        padding: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              padding: 8,
              borderRadius: tokens.radius.full,
              background: c.primary50,
              color: c.primary,
            }}
          >
            <Image src={provider.logoSrc} alt={provider.logoAlt} width={20} height={20} />
          </div>
          <div>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
              {pt?.title?.value || pt?.title || `${provider.providerName} Sync`}
            </p>
            <p style={{ fontWeight: 600, color: 'var(--foreground)' }}>{statusLabel}</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {loading
                ? pt?.loading?.value || pt?.loading || 'Loading...'
                : (pt?.lastSync?.value || 'Last sync: {time}').replace(
                    '{time}',
                    formatDateTime(status?.settings?.lastSyncAt, locale) || '—',
                  )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {status?.connected ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void handleImport();
                }}
                disabled={working}
                style={primaryBtn}
              >
                <UploadCloud size={16} />
                {pt?.actions?.import?.value || pt?.actions?.import || 'Import'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSyncNow();
                }}
                disabled={working}
                style={outlineBtn}
              >
                <RefreshCcw size={16} />
                {pt?.actions?.syncNow?.value || pt?.actions?.syncNow || 'Sync Now'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                void handleConnect();
              }}
              disabled={working}
              style={primaryBtn}
            >
              <RefreshCcw size={16} />
              {pt?.actions?.connect?.value || pt?.actions?.connect || 'Connect'}
            </button>
          )}
          <Link
            href={provider.settingsHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--border-color)',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--foreground)',
              textDecoration: 'none',
            }}
          >
            <Settings size={16} />
            {pt?.actions?.settings?.value || pt?.actions?.settings || 'Settings'}
          </Link>
        </div>
      </div>
    </div>
  );
}
