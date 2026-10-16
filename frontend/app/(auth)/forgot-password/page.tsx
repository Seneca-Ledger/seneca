'use client';

import { Box, Button, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import NextLink from 'next/link';
import React, { useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { Check } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { AuthHero } from '../AuthHero';
import AuthLayout from '../AuthLayout';

export default function ForgotPasswordPage(): React.JSX.Element {
  const t = useIntlayer('forgotPasswordPage');
  const tl = useIntlayer('loginPage');
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

  // The same right half as sign-in: what Lumio is for, not this form's text again.
  const sideContent = <AuthHero tagline={tl.rightTagline} />;

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      <div className="lumio-auth-logo" role="img" aria-label="Lumio" />
      <Typography component="h1" className="lumio-auth-title lumio-auth-title--with-lead">
        {t.title}
      </Typography>
      <p className="lumio-auth-lead">{t.subtitle}</p>

      {sent ? (
        <p role="status" className="lumio-auth-notice">
          <Check size={18} aria-hidden />
          <span>{t.sent}</span>
        </p>
      ) : (
        <Box
          component="form"
          onSubmit={handleSubmit}
          className="lumio-auth-form"
          sx={{ width: '100%' }}
        >
          <div className="lumio-auth-field">
            <label htmlFor="email" className="lumio-auth-field__label">
              {t.emailLabel}
            </label>
            <TextField
              required
              fullWidth
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={Boolean(error)}
              slotProps={{ htmlInput: { 'aria-describedby': error ? 'forgot-error' : undefined } }}
            />
            {error ? (
              <p id="forgot-error" role="alert" className="lumio-auth-error">
                {error}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            className="lumio-auth-submit"
            disabled={loading}
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

      <p className="lumio-auth-footnote">
        <NextLink href="/login" className="lumio-auth-link lumio-auth-link--accent">
          {t.backToLogin}
        </NextLink>
      </p>
    </AuthLayout>
  );
}
