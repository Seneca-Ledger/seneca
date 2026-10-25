'use client';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import { Download as DownloadIcon, Lock as LockIcon } from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { SharedFileAccess } from '@/app/lib/contracts';
import { checkContract } from '@/app/lib/query-fn-schema';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import TransactionsView from '../../components/TransactionsView';
import api from '../../lib/api';
import { blobOf } from '../../lib/blob-of';

/** The link's password goes in a header, never the URL: query strings end up in logs. */
const sharePasswordHeaders = (password?: string): Record<string, string> =>
  password ? { 'x-share-password': password } : {};

/**
 * Public page for accessing shared files
 */
export default function SharedFilePage() {
  const params = useParams();
  const token = params.token as string;
  const t = useIntlayer('sharedFilePage');
  const { locale } = useLocale();

  const [access, setAccess] = useState<SharedFileAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  const getPermissionLabel = (permission: string): string => {
    switch (permission) {
      case 'view':
        return t.permission.view.value;
      case 'download':
        return t.permission.download.value;
      case 'edit':
        return t.permission.edit.value;
      default:
        return permission;
    }
  };

  const loadSharedFile = async (pwd?: string): Promise<void> => {
    await (async () => {
      setLoading(true);
      setError(null);

      const response = await api.get(`/storage/shared/${token}`, {
        headers: sharePasswordHeaders(pwd),
      });

      setAccess(await checkContract('SharedFileAccess', response.data, '/storage/shared/:token'));
      setNeedsPassword(false);
    })()
      .catch(async err => {
        const status =
          typeof err === 'object' && err !== null && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;

        if (status === 401) {
          setNeedsPassword(true);
          setError(t.errors.passwordRequired.value);
        } else {
          setError(getApiErrorMessage(err, t.errors.loadFailed.value));
        }
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  const loadForToken = useEffectEvent(() => {
    void loadSharedFile();
  });
  useEffect(() => {
    loadForToken();
  }, [token]);

  const handlePasswordSubmit = (): void => {
    void loadSharedFile(password);
  };

  const handleDownload = async (): Promise<void> => {
    if (!access) return;

    await (async () => {
      const response = await api.get(`/storage/shared/${token}/download`, {
        headers: sharePasswordHeaders(password),
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([blobOf(response)]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', access.statement.fileName);
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
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 8, mb: 4 }}>
        <Typography align="center">{t.loading}</Typography>
      </Container>
    );
  }

  if (needsPassword) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <LockIcon size={64} style={{ color: 'var(--mui-palette-primary-main)' }} />
            <Typography variant="h5" align="center">
              {t.protected.title}
            </Typography>
            <Typography
              variant="body1"
              align="center"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.protected.subtitle}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ width: '100%' }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label={t.protected.passwordLabel.value}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter') handlePasswordSubmit();
              }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handlePasswordSubmit}
              disabled={!password}
            >
              {t.protected.open}
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (error || !access) {
    return (
      <Container maxWidth="lg" sx={{ mt: 8, mb: 4 }}>
        <Alert severity="error">{error || t.errors.notFound.value}</Alert>
      </Container>
    );
  }

  const { statement, transactions, permission, canDownload } = access;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {statement.fileName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip label={t.header.badge.value} size="small" color="info" />
          <Chip label={statement.bankName} size="small" variant="outlined" />
          <Chip
            label={`${t.permission.prefix.value}: ${getPermissionLabel(permission)}`}
            size="small"
          />
          {canDownload && (
            <Button
              variant="contained"
              size="small"
              startIcon={<DownloadIcon size={18} />}
              onClick={handleDownload}
              sx={{ ml: 'auto' }}
            >
              {t.header.download}
            </Button>
          )}
        </Box>
      </Box>

      {/* File info */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(4, 1fr)',
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.cards.bank}
            </Typography>
            <Typography variant="h6">{statement.bankName}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.cards.fileSize}
            </Typography>
            <Typography variant="h6">{formatFileSize(statement.fileSize)}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.cards.transactions}
            </Typography>
            <Typography variant="h6">{transactions.length}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.cards.account}
            </Typography>
            <Typography variant="h6">{statement.accountNumber || t.cards.dash.value}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Transactions */}
      {transactions.length > 0 ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            {t.transactionsTitle}
          </Typography>
          <TransactionsView transactions={transactions} />
        </Box>
      ) : (
        <Alert severity="info">{t.errors.noTransactionsAccess}</Alert>
      )}
    </Container>
  );
}
