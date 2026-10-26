'use client';

import { Box, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { BrandLockup } from '@/app/components/BrandLockup';
import { Check, Eye, EyeOff } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { AuthHero } from '../AuthHero';
import AuthLayout from '../AuthLayout';

const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordContent(): React.JSX.Element {
  const t = useIntlayer('resetPasswordPage');
  const tl = useIntlayer('loginPage');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which field the message is about: the first one, the second, or neither.
  const [errorField, setErrorField] = useState<'password' | 'confirm' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    if (!token) {
      setErrorField(null);
      setError(t.missingToken.value);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorField('password');
      setError(t.tooShort.value);
      return;
    }
    if (password !== confirmPassword) {
      setErrorField('confirm');
      setError(t.mismatch.value);
      return;
    }

    setLoading(true);
    setErrorField(null);
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

  const sideContent = <AuthHero tagline={tl.rightTagline} />;
  const fieldError = (field: 'password' | 'confirm') =>
    error && errorField === field ? (
      <p id={`${field}-error`} role="alert" className="seneca-auth-error">
        {error}
      </p>
    ) : null;
  const visibilityToggle = (
    <InputAdornment position="end">
      <IconButton
        edge="end"
        size="small"
        aria-label={(showPassword ? tl.hidePassword : tl.showPassword).value}
        aria-pressed={showPassword}
        onClick={() => setShowPassword(prev => !prev)}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      <BrandLockup className="seneca-auth-logo" />
      <Typography component="h1" className="seneca-auth-title seneca-auth-title--with-lead">
        {t.title}
      </Typography>
      <p className="seneca-auth-lead">{t.subtitle}</p>

      {done ? (
        <p role="status" className="seneca-auth-notice">
          <Check size={18} aria-hidden />
          <span>{t.success}</span>
        </p>
      ) : (
        <Box
          component="form"
          onSubmit={handleSubmit}
          className="seneca-auth-form"
          sx={{ width: '100%' }}
        >
          <div className="seneca-auth-field">
            <label htmlFor="password" className="seneca-auth-field__label">
              {t.passwordLabel}
            </label>
            <TextField
              required
              fullWidth
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={errorField === 'password'}
              slotProps={{
                htmlInput: {
                  'aria-describedby': errorField === 'password' ? 'password-error' : undefined,
                },
                input: { endAdornment: visibilityToggle },
              }}
            />
            {fieldError('password')}
          </div>
          <div className="seneca-auth-field">
            <label htmlFor="confirmPassword" className="seneca-auth-field__label">
              {t.confirmLabel}
            </label>
            <TextField
              required
              fullWidth
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              error={errorField === 'confirm'}
              slotProps={{
                htmlInput: {
                  'aria-describedby': errorField === 'confirm' ? 'confirm-error' : undefined,
                },
              }}
            />
            {fieldError('confirm')}
          </div>
          {error && errorField === null ? (
            <p role="alert" className="seneca-auth-error">
              {error}
            </p>
          ) : null}
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
                {t.saving}
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

export default function ResetPasswordPage(): React.JSX.Element {
  // useSearchParams needs a Suspense boundary, same as the login page.
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
