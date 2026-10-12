'use client';

import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import MuiLink from '@mui/material/Link';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';
import AuthLayout from '../AuthLayout';

const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordContent(): React.JSX.Element {
  const t = useIntlayer('resetPasswordPage');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    if (!token) {
      setError(t.missingToken.value);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t.tooShort.value);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.mismatch.value);
      return;
    }

    setLoading(true);
    setError(null);

    await apiClient
      .post('/auth/reset-password', {
        token,
        newPassword: password,
      } satisfies ContractInput<'ResetPasswordBody'>)
      .then(() => {
        setDone(true);
      })
      .catch((err: unknown) => {
        setError(getApiErrorMessage(err, t.genericError.value));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const sideContent = (
    <Box sx={{ color: 'white' }}>
      <Typography
        variant="h2"
        fontWeight="bold"
        gutterBottom
        sx={{
          fontFamily: 'var(--font-nunito), "Nunito", sans-serif',
          textShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        Lumio
      </Typography>
      <Typography variant="h5" sx={{ opacity: 0.9, lineHeight: 1.6 }}>
        {t.subtitle}
      </Typography>
    </Box>
  );

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      <Typography variant="h4" fontWeight="bold" align="center" sx={{ mb: 1 }}>
        {t.title}
      </Typography>
      <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
        {t.subtitle}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {done ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t.success}
        </Alert>
      ) : (
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="password"
            name="password"
            type="password"
            label={t.passwordLabel.value}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            InputProps={{ sx: { borderRadius: tokens.radius.md } }}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label={t.confirmLabel.value}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            InputProps={{ sx: { borderRadius: tokens.radius.md } }}
            sx={{ mb: 2 }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 1, mb: 3, borderRadius: tokens.radius.md, py: 1.5 }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1, color: 'inherit' }} />
                {t.saving}
              </>
            ) : (
              t.submit
            )}
          </Button>
        </Box>
      )}

      <Typography variant="body2" align="center">
        <MuiLink component={NextLink} href="/login" underline="hover">
          {t.backToLogin}
        </MuiLink>
      </Typography>
    </AuthLayout>
  );
}

export default function ResetPasswordPage(): React.JSX.Element {
  // useSearchParams needs a Suspense boundary, same as the login page.
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
