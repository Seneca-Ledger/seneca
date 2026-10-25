'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { Spinner } from '@/app/components/ui/spinner';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

type Props = {
  tx: (path: string[], fallback: string) => string;
  onAccountDeleted: () => void;
};

const downloadJson = (payload: unknown, fileName: string): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export function MyDataSection({ tx, onAccountDeleted }: Props) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    setError(null);
    setMessage(null);

    await (async () => {
      const response = await apiClient.get('/users/me/export');
      downloadJson(response.data, 'seneca-account-export.json');
      setMessage(tx(['myDataCard', 'exportSuccess'], 'Your data has been downloaded.'));
    })()
      .catch(async caught => {
        setError(getApiErrorMessage(caught, tx(['myDataCard', 'exportFailed'], 'Export failed.')));
      })
      .finally(async () => {
        setExporting(false);
      });
  };

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    setError(null);

    await (async () => {
      await apiClient.delete('/users/me', { data: { currentPassword: password } });
      onAccountDeleted();
    })()
      .catch(async caught => {
        setError(
          getApiErrorMessage(
            caught,
            tx(['myDataCard', 'deleteFailed'], 'Account deletion failed.'),
          ),
        );
      })
      .finally(async () => {
        setDeleting(false);
        setPassword('');
      });
  };

  return (
    <Stack spacing={2.5}>
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Box>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
          }}
        >
          {tx(['myDataCard', 'exportTitle'], 'Download your data')}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.5,
            mb: 1.5,
          }}
        >
          {tx(
            ['myDataCard', 'exportDescription'],
            'A JSON copy of your profile, sessions, memberships, notifications, and audit trail. Workspace financial records are not included — they belong to the workspace.',
          )}
        </Typography>
        <Button variant="outlined" size="small" onClick={handleExport} disabled={exporting}>
          {exporting ? <Spinner size={16} /> : tx(['myDataCard', 'exportButton'], 'Download JSON')}
        </Button>
      </Box>

      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: 'error.main',
          }}
        >
          {tx(['myDataCard', 'deleteTitle'], 'Delete your account')}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.5,
            mb: 1.5,
          }}
        >
          {tx(
            ['myDataCard', 'deleteDescription'],
            'This cannot be undone. If you are the only owner of a workspace, transfer ownership first.',
          )}
        </Typography>

        {confirmOpen ? (
          <Stack spacing={1.5} sx={{ maxWidth: 360 }}>
            <TextField
              type="password"
              size="small"
              label={tx(['myDataCard', 'passwordLabel'], 'Current password')}
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={handleDelete}
                disabled={deleting || password.length === 0}
              >
                {deleting ? (
                  <Spinner size={16} />
                ) : (
                  tx(['myDataCard', 'deleteConfirm'], 'Delete permanently')
                )}
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setConfirmOpen(false);
                  setPassword('');
                }}
                disabled={deleting}
              >
                {tx(['myDataCard', 'cancel'], 'Cancel')}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => setConfirmOpen(true)}
          >
            {tx(['myDataCard', 'deleteButton'], 'Delete account')}
          </Button>
        )}
      </Box>
    </Stack>
  );
}
