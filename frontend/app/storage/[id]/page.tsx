'use client';
import { resolveBankLogo } from '@bank-logos';
import { Box, Chip, Typography } from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  RefreshCcw,
  Share2,
  Shield,
  ShieldCheck,
} from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage, getApiErrorStatus } from '@/app/lib/api-error';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import PermissionsPanel from '../../components/PermissionsPanel';
import ShareDialog from '../../components/ShareDialog';
import TransactionsView from '../../components/TransactionsView';
import api from '../../lib/api';
import { blobOf } from '../../lib/blob-of';
import type { StorageFileDetails } from '../../lib/contracts';
import { checkContract } from '../../lib/query-fn-schema';

type FileDetails = StorageFileDetails;
type FileAvailability = FileDetails['fileAvailability'];
type FileAvailabilityStatus = FileAvailability['status'];

const getBankDisplayName = (bankName: string): string => {
  const resolved = resolveBankLogo(bankName);
  if (!resolved) {
    return bankName;
  }
  return resolved.key !== 'other' ? resolved.displayName : bankName;
};

function FileDetailsSkeleton(): React.JSX.Element {
  return (
    <Box
      className="container-shared"
      sx={{ px: 2, py: 4, display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { sm: 'center' },
          justifyContent: { sm: 'space-between' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Skeleton variant="circular" width={36} height={36} />
          <Box>
            <Skeleton variant="text" width={220} height={28} />
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Skeleton variant="rounded" width={90} height={22} />
              <Skeleton variant="rounded" width={90} height={22} />
              <Skeleton variant="rounded" width={90} height={22} />
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Skeleton variant="rounded" width={110} height={36} />
          <Skeleton variant="rounded" width={90} height={36} />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1.4fr' } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 1.5,
          }}
        >
          {[0, 1, 2, 3].map(idx => (
            <Box
              key={idx}
              sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper', p: 2 }}
            >
              <Skeleton variant="text" width={60} height={14} />
              <Skeleton variant="text" width={90} height={24} />
            </Box>
          ))}
        </Box>

        <Box sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper', p: 2 }}>
          <Skeleton variant="text" width={140} height={24} />
          <Skeleton variant="rectangular" sx={{ mt: 1.5 }} width="100%" height={360} />
        </Box>
      </Box>

      <Box sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper', p: 2 }}>
        <Skeleton variant="text" width={160} height={20} />
        <Skeleton variant="rectangular" sx={{ mt: 1.5 }} width="100%" height={200} />
      </Box>
    </Box>
  );
}

/**
 * File details page with transactions, sharing, and permissions
 */
export default function FileDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = params.id as string;
  const initialTab = searchParams.get('tab') || 'transactions';
  const t = useIntlayer('storageDetailsPage');
  const { locale } = useLocale();

  const [details, setDetails] = useState<FileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'transactions' | 'links' | 'permissions'>(
    initialTab === 'permissions'
      ? 'permissions'
      : initialTab === 'share'
        ? 'links'
        : 'transactions',
  );
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreviewUrl = (): void => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      revokePreviewUrl();
    };
  }, []);

  const loadFileDetails = async (): Promise<FileDetails | null> => {
    return await (async () => {
      setLoading(true);
      const response = await api.get(`/storage/files/${fileId}`);
      const loaded = await checkContract('StorageFileDetails', response.data, '/storage/files/:id');
      setDetails(loaded);
      return loaded;
    })()
      .catch(async error => {
        console.error('Failed to load file details:', error);
        setDetails(null);
        return null;
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  const loadPreview = async (
    availabilityStatusOverride?: FileAvailabilityStatus,
  ): Promise<void> => {
    const availabilityStatus = availabilityStatusOverride ?? details?.fileAvailability?.status;
    if (availabilityStatus === 'missing') {
      setPreviewError(t.preview.unavailable.value);
      revokePreviewUrl();
      setPreviewUrl(null);
      setPreviewLoading(false);
      return;
    }

    await (async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      revokePreviewUrl();
      setPreviewUrl(null);

      const response = await api.get(`/storage/files/${fileId}/view`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(blobOf(response));
      previewUrlRef.current = url;
      setPreviewUrl(url);
    })()
      .catch(async error => {
        console.error('Failed to load file preview:', error);
        const message =
          getApiErrorStatus(error) === 404
            ? t.preview.unavailable.value
            : getApiErrorMessage(error, t.toasts.previewFailed.value);
        setPreviewError(message);
        setPreviewUrl(null);
      })
      .finally(async () => {
        setPreviewLoading(false);
      });
  };

  const loadDetailsAndPreview = useEffectEvent(async (isCancelled: () => boolean) => {
    const loadedDetails = await loadFileDetails();
    if (isCancelled()) {
      return;
    }

    if (loadedDetails?.fileAvailability?.status === 'missing') {
      setPreviewError(t.preview.unavailable.value);
      revokePreviewUrl();
      setPreviewUrl(null);
      setPreviewLoading(false);
      return;
    }

    await loadPreview(loadedDetails?.fileAvailability?.status);
  });

  useEffect(() => {
    let cancelled = false;
    void loadDetailsAndPreview(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const handleDownload = async (): Promise<void> => {
    if (!details) {
      return;
    }

    await (async () => {
      const response = await api.get(`/storage/files/${fileId}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([blobOf(response)]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', details.statement.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    })().catch(async error => {
      console.error('Failed to download file:', error);
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return formatStoredDateWithOptions(
      date,
      { year: 'numeric', month: 'long', day: 'numeric' },
      resolveLocaleTag(locale),
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getPermissionLabel = (permission?: string | null): string => {
    switch ((permission || '').toLowerCase()) {
      case 'owner':
        return t.permission.owner.value;
      case 'editor':
        return t.permission.editor.value;
      case 'viewer':
        return t.permission.viewer.value;
      case 'downloader':
        return t.permission.downloader.value;
      default:
        return t.permission.access.value;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed':
        return t.status.completed.value;
      case 'processing':
        return t.status.processing.value;
      case 'error':
        return t.status.error.value;
      case 'uploaded':
        return t.status.uploaded.value;
      default:
        return status;
    }
  };

  const getAvailabilityLabel = (status: FileAvailabilityStatus): React.ReactNode => {
    switch (status) {
      case 'both':
        return t.availability.labels.both;
      case 'disk':
        return t.availability.labels.disk;
      case 'db':
        return t.availability.labels.db;
      case 'missing':
        return t.availability.labels.missing;
      default:
        return status;
    }
  };

  const getAvailabilityTooltip = (status: FileAvailabilityStatus): string => {
    switch (status) {
      case 'both':
        return t.availability.tooltips.both.value;
      case 'disk':
        return t.availability.tooltips.disk.value;
      case 'db':
        return t.availability.tooltips.db.value;
      case 'missing':
        return t.availability.tooltips.missing.value;
      default:
        return status;
    }
  };

  const renderAvailabilityBadge = (availability?: FileAvailability): React.JSX.Element | null => {
    if (!availability) {
      return null;
    }
    const status = availability.status;
    const chipSx =
      status === 'missing'
        ? {
            bgcolor: 'var(--color-error-soft-bg)',
            color: 'var(--destructive)',
            border: '1px solid #fecaca',
          }
        : status === 'both'
          ? {
              bgcolor: 'var(--color-success-soft-bg)',
              color: 'var(--color-success-soft-text)',
              border: '1px solid var(--color-success-soft-border)',
            }
          : {
              bgcolor: 'var(--color-info-soft-bg)',
              color: 'var(--color-info-soft-text)',
              border: '1px solid var(--color-info-soft-border)',
            };

    return (
      <Chip
        label={getAvailabilityLabel(status)}
        size="small"
        title={getAvailabilityTooltip(status)}
        sx={{ borderRadius: tokens.radius.sm, fontSize: 12, fontWeight: 600, ...chipSx }}
      />
    );
  };

  if (loading) {
    return <FileDetailsSkeleton />;
  }

  if (!details) {
    return (
      <Box className="container-shared" sx={{ px: 2, py: 6 }}>
        <Box sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper', p: 3 }}>
          <Typography
            style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)', marginBottom: 8 }}
          >
            {t.notFound}
          </Typography>
          <Box
            component="button"
            type="button"
            onClick={() => router.push('/statements')}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              border: '1px solid var(--border-color)',
              px: 1.5,
              py: 1,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--foreground)',
              bgcolor: 'transparent',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'var(--muted)' },
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            {t.tabs.transactions.value}
          </Box>
        </Box>
      </Box>
    );
  }

  const {
    statement,
    transactions,
    sharedLinks,
    permissions,
    isOwner,
    userPermission,
    fileAvailability,
  } = details;

  const tabs = [
    {
      key: 'transactions' as const,
      label: `${t.tabs.transactions.value} (${transactions.length})`,
    },
    { key: 'links' as const, label: `${t.tabs.links.value} (${sharedLinks.length})` },
    ...(isOwner
      ? [
          {
            key: 'permissions' as const,
            label: `${t.tabs.permissions.value} (${permissions.length})`,
          },
        ]
      : []),
  ];

  return (
    <Box
      className="container-shared"
      sx={{ px: 2, py: 4, display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { sm: 'center' },
          justifyContent: { sm: 'space-between' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box
            component="button"
            type="button"
            onClick={() => router.push('/statements')}
            aria-label={t.actions.backToStorage.value}
            sx={{
              borderRadius: tokens.radius.full,
              border: '1px solid var(--border-color)',
              bgcolor: 'background.paper',
              p: 1,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'var(--muted)' },
            }}
          >
            <ArrowLeft style={{ width: 20, height: 20 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                component="h1"
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--foreground)',
                  wordBreak: 'break-all',
                }}
              >
                {statement.fileName}
              </Typography>
            </Box>
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Chip
                label={getBankDisplayName(statement.bankName)}
                size="small"
                sx={{
                  borderRadius: tokens.radius.sm,
                  fontSize: 12,
                  fontWeight: 600,
                  bgcolor: 'rgba(var(--primary-rgb),0.1)',
                  color: 'primary.main',
                  border: '1px solid rgba(var(--primary-rgb),0.2)',
                }}
              />
              <Chip
                label={getStatusLabel(statement.status)}
                size="small"
                sx={{
                  borderRadius: tokens.radius.sm,
                  fontSize: 12,
                  fontWeight: 600,
                  bgcolor: 'var(--color-success-soft-bg)',
                  color: 'var(--color-success-soft-text)',
                  border: '1px solid var(--color-success-soft-border)',
                }}
              />
              {renderAvailabilityBadge(fileAvailability)}
              <Chip
                icon={
                  isOwner ? (
                    <ShieldCheck style={{ width: 16, height: 16 }} />
                  ) : (
                    <Shield style={{ width: 16, height: 16 }} />
                  )
                }
                label={isOwner ? t.permission.owner.value : getPermissionLabel(userPermission)}
                size="small"
                sx={{
                  borderRadius: tokens.radius.sm,
                  fontSize: 12,
                  fontWeight: 600,
                  bgcolor: 'var(--muted)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border-color)',
                }}
              />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Box
            component="button"
            type="button"
            onClick={handleDownload}
            title={t.actions.downloadTooltip.value}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              border: '1px solid var(--border-color)',
              bgcolor: 'background.paper',
              px: 1.5,
              py: 1,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--foreground)',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'var(--muted)' },
            }}
          >
            <Download style={{ width: 16, height: 16 }} />
            {t.actions.download}
          </Box>
          {(isOwner || userPermission === 'editor') && (
            <Box
              component="button"
              type="button"
              onClick={() => {
                setCurrentTab('links');
                setShareDialogOpen(true);
              }}
              title={t.actions.shareTooltip.value}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'var(--primary-fill)',
                px: 2,
                py: 1,
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                border: 'none',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <Share2 style={{ width: 16, height: 16 }} />
              {t.actions.share}
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1.4fr' } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 1.5,
          }}
        >
          {[
            { label: t.cards.size, value: formatFileSize(statement.fileSize) },
            { label: t.cards.transactions, value: transactions.length },
            { label: t.cards.uploadedAt, value: formatDate(statement.createdAt) },
            {
              label: t.cards.account,
              value: statement.accountNumber || t.cards.dash.value,
            },
          ].map((card, idx) => (
            <Box
              key={idx}
              sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper', p: 2 }}
            >
              <Typography
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--muted-foreground)',
                }}
              >
                {card.label}
              </Typography>
              <Typography
                style={{ marginTop: 4, fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}
              >
                {card.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper', p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              <RefreshCcw
                style={{ width: 16, height: 16, color: 'var(--color-primary, #168118)' }}
              />
              <Typography style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                {t.preview.title}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Box
                component="button"
                type="button"
                onClick={() => loadPreview()}
                disabled={previewLoading}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  border: '1px solid var(--border-color)',
                  bgcolor: 'background.paper',
                  px: 1.5,
                  py: 0.75,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'var(--muted)' },
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                {previewLoading ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <RefreshCcw style={{ width: 16, height: 16 }} />
                )}
                {t.preview.refresh}
              </Box>
              {previewUrl && (
                <Box
                  component="button"
                  type="button"
                  onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    border: '1px solid var(--border-color)',
                    bgcolor: 'background.paper',
                    px: 1.5,
                    py: 0.75,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'var(--muted)' },
                  }}
                >
                  <ExternalLink style={{ width: 16, height: 16 }} />
                  {t.preview.openNewTab}
                </Box>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              mt: 1.5,
              overflow: 'hidden',
              border: '1px dashed var(--border-color)',
              bgcolor: 'rgba(249,250,251,0.6)',
            }}
          >
            {previewLoading && (
              <Box
                sx={{
                  display: 'flex',
                  minHeight: 360,
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted-foreground)',
                }}
              >
                <Spinner className="h-6 w-6" />
              </Box>
            )}

            {!previewLoading && previewError && (
              <Box
                sx={{
                  display: 'flex',
                  minHeight: 360,
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  bgcolor: 'background.paper',
                  px: 2,
                  textAlign: 'center',
                }}
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: 'var(--color-error-soft-bg)',
                    px: 1.5,
                    py: 0.5,
                    fontSize: 14,
                    color: 'var(--destructive)',
                  }}
                >
                  {previewError}
                </Box>
                <Box
                  component="button"
                  type="button"
                  onClick={() => loadPreview()}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: 'var(--primary-fill)',
                    px: 2,
                    py: 1,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: 'pointer',
                    border: 'none',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  <RefreshCcw style={{ width: 16, height: 16 }} />
                  {t.preview.retry}
                </Box>
              </Box>
            )}

            {!(previewLoading || previewError) && previewUrl && (
              <iframe
                src={previewUrl}
                title={t.preview.iframeTitle.value}
                style={{
                  height: 420,
                  width: '100%',
                  border: 'none',
                  background: 'var(--card-bg)',
                  display: 'block',
                }}
              />
            )}

            {!(previewLoading || previewError || previewUrl) && (
              <Box
                sx={{
                  display: 'flex',
                  minHeight: 360,
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.paper',
                  px: 2,
                  textAlign: 'center',
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                }}
              >
                {t.preview.empty}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper' }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid var(--muted)',
            px: 2,
            py: 1.5,
          }}
        >
          {tabs.map(tab => {
            const isActive = tab.key === currentTab;
            return (
              <Box
                key={tab.key}
                component="button"
                type="button"
                onClick={() => setCurrentTab(tab.key)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  bgcolor: isActive ? 'primary.main' : 'var(--muted)',
                  color: isActive ? '#fff' : 'var(--foreground)',
                  '&:hover': isActive ? {} : { bgcolor: 'var(--muted)' },
                }}
              >
                {tab.label}
              </Box>
            );
          })}
        </Box>

        <Box sx={{ p: 2 }}>
          {currentTab === 'transactions' && (
            <Box sx={{ border: '1px solid var(--muted)', bgcolor: 'background.paper' }}>
              <TransactionsView transactions={transactions} />
            </Box>
          )}

          {currentTab === 'links' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Typography style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
                  {t.tabs.links.value}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setShareDialogOpen(true)}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: 'var(--primary-fill)',
                      px: 1.5,
                      py: 1,
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#fff',
                      cursor: 'pointer',
                      border: 'none',
                      '&:hover': { bgcolor: 'primary.dark' },
                    }}
                  >
                    <Share2 style={{ width: 16, height: 16 }} />
                    {t.actions.share}
                  </Box>
                </Box>
              </Box>

              {sharedLinks.length === 0 ? (
                <Box
                  sx={{
                    border: '1px dashed var(--border-color)',
                    bgcolor: 'var(--muted)',
                    px: 2,
                    py: 3,
                    textAlign: 'center',
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t.tabs.links.value} — {t.preview.empty}
                </Box>
              ) : (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {sharedLinks.map(link => (
                    <Box
                      key={link.id}
                      sx={{
                        border: '1px solid var(--border-color)',
                        bgcolor: 'background.paper',
                        px: 2,
                        py: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 1,
                              fontSize: 14,
                              fontWeight: 600,
                              color: 'var(--foreground)',
                            }}
                          >
                            <Chip
                              label={link.permission}
                              size="small"
                              sx={{
                                borderRadius: tokens.radius.sm,
                                fontSize: 12,
                                fontWeight: 600,
                                bgcolor: 'var(--color-info-soft-bg)',
                                color: 'var(--color-info-soft-text)',
                              }}
                            />
                            <Chip
                              label={link.status}
                              size="small"
                              sx={{
                                borderRadius: tokens.radius.sm,
                                fontSize: 12,
                                fontWeight: 600,
                                ...(link.status === 'active'
                                  ? {
                                      bgcolor: 'var(--color-success-soft-bg)',
                                      color: 'var(--color-success-soft-text)',
                                    }
                                  : { bgcolor: 'var(--muted)', color: 'var(--text-secondary)' }),
                              }}
                            />
                            {link.expiresAt && (
                              <Chip
                                label={formatDate(link.expiresAt)}
                                size="small"
                                sx={{
                                  borderRadius: tokens.radius.sm,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  bgcolor: 'var(--muted)',
                                  color: 'var(--foreground)',
                                }}
                              />
                            )}
                          </Box>
                          {link.description && (
                            <Typography style={{ fontSize: 14, color: 'var(--foreground)' }}>
                              {link.description}
                            </Typography>
                          )}
                          <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                            {t.cards.uploadedAt}: {formatDate(link.createdAt)} ·{' '}
                            {t.cards.transactions}: {link.accessCount}
                          </Typography>
                        </Box>

                        <Box
                          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
                        >
                          <Box
                            component="button"
                            type="button"
                            onClick={() => {
                              const shareUrl = `${window.location.origin}/shared/${link.token}`;
                              navigator.clipboard.writeText(shareUrl).catch(() => undefined);
                            }}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 1,
                              border: '1px solid var(--border-color)',
                              bgcolor: 'background.paper',
                              px: 1.5,
                              py: 0.75,
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--foreground)',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'var(--muted)' },
                            }}
                          >
                            {t.actions.share}
                          </Box>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => setShareDialogOpen(true)}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 1,
                              border: '1px solid var(--border-color)',
                              bgcolor: 'background.paper',
                              px: 1.5,
                              py: 0.75,
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--foreground)',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'var(--muted)' },
                            }}
                          >
                            {t.preview.refresh}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {currentTab === 'permissions' && isOwner && (
            <Box sx={{ border: '1px solid var(--muted)', bgcolor: 'background.paper' }}>
              <PermissionsPanel
                fileId={fileId}
                permissions={permissions}
                onPermissionsUpdate={loadFileDetails}
              />
            </Box>
          )}
        </Box>
      </Box>

      <ShareDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        fileId={fileId}
        sharedLinks={sharedLinks}
        onLinksUpdate={loadFileDetails}
      />
    </Box>
  );
}
