'use client';

import { Box, Button, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import NextLink from 'next/link';
import React, { useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { BrandLockup } from '@/app/components/BrandLockup';
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

  // The same right half as sign-in: what Seneca is for, not this form's text again.
  const sideContent = <AuthHero tagline={tl.rightTagline} />;

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      <BrandLockup className="seneca-auth-logo" />
      <Typography component="h1" className="seneca-auth-title seneca-auth-title--with-lead">
        {t.title}
      </Typography>
      <p className="seneca-auth-lead">{t.subtitle}</p>

      {sent ? (
        <p role="status" className="seneca-auth-notice">
          <Check size={18} aria-hidden />
          <span>{t.sent}</span>
        </p>
      ) : (
        <Box
          component="form"
          onSubmit={handleSubmit}
          className="seneca-auth-form"
          sx={{ width: '100%' }}
        >
          <div className="seneca-auth-field">
            <label htmlFor="email" className="seneca-auth-field__label">
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
              <p id="forgot-error" role="alert" className="seneca-auth-error">
                {error}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            className="seneca-auth-submit"
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

      <p className="seneca-auth-footnote">
        <NextLink href="/login" className="seneca-auth-link seneca-auth-link--accent">
          {t.backToLogin}
        </NextLink>
      </p>
    </AuthLayout>
  );
}
