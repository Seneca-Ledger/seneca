'use client';

import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import MuiLink from '@mui/material/Link';
import NextLink from 'next/link';
import React, { useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';
import AuthLayout from '../AuthLayout';

export default function ForgotPasswordPage(): React.JSX.Element {
  const t = useIntlayer('forgotPasswordPage');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    await apiClient
      .post('/auth/forgot-password', { email } satisfies ContractInput<'ForgotPasswordBody'>)
      .then(() => {
        // The backend answers the same way for known and unknown addresses, so
        // this screen must not distinguish them either.
        setSent(true);
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

      {sent ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t.sent}
        </Alert>
      ) : (
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label={t.emailLabel.value}
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
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
                {t.sending}
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
