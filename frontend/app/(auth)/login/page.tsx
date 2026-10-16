/* eslint-disable max-lines */
'use client';

import { Box, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { Eye, EyeOff } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { syncLocaleFromUser } from '@/app/lib/locale';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { safeInternalPath } from '@/app/lib/safe-path';
import { AuthHero } from '../AuthHero';
import AuthLayout from '../AuthLayout';

// eslint-disable-next-line complexity
function extractInviteTokenFromNext(nextPath: string | null): string | null {
  if (!nextPath) {
    return null;
  }
  try {
    const url = new URL(nextPath, 'http://localhost');
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'invite') {
      return null;
    }
    return segments[1] || null;
  } catch {
    const pathOnly = nextPath.split('?')[0]?.split('#')[0] || '';
    const segments = pathOnly.split('/').filter(Boolean);
    if (segments[0] !== 'invite') {
      return null;
    }
    return segments[1] || null;
  }
}

// eslint-disable-next-line max-lines-per-function, complexity
function LoginPageContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get('next'));
  const inviteTokenFromNext = extractInviteTokenFromNext(nextPath);
  const inviteToken = searchParams.get('invite') || inviteTokenFromNext;
  const t = useIntlayer('loginPage');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // eslint-disable-next-line max-lines-per-function
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    return await (async () => {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
        ...(twoFactorCode ? { twoFactorCode: twoFactorCode.trim() } : {}),
      } satisfies ContractInput<'LoginBody'>);

      const result = await checkContract('LoginResponse', response.data, '/auth/login');
      // Password was right, but the account also needs a second factor.
      if ('twoFactorRequired' in result) {
        setTwoFactorRequired(true);
        return;
      }

      // Токены пришли httpOnly-куками и в теле ответа их больше нет —
      // хранить тут нечего, кроме профиля для первого рендера.
      const { user } = result;

      localStorage.setItem('user', JSON.stringify(user));
      syncLocaleFromUser(user);
      if (user.workspaceId) {
        localStorage.setItem('currentWorkspaceId', user.workspaceId);
      }

      if (!inviteToken && user.onboardingCompletedAt == null) {
        window.location.href = '/onboarding';
        return;
      }

      const activeWorkspaceId = user.lastWorkspaceId || user.workspaceId;

      if (activeWorkspaceId) {
        localStorage.setItem('currentWorkspaceId', activeWorkspaceId);
        window.location.href = nextPath || DEFAULT_APP_ROUTE;
      } else {
        window.location.href = '/workspaces';
      }
    })()
      .catch(async (error: unknown) => {
        setError(getApiErrorMessage(error, t.loginFailed.value));
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  // The name is the logo on the left; the right half only says what it is for.
  const sideContent = <AuthHero tagline={t.rightTagline} />;
  const registerHref = nextPath
    ? `/register?next=${encodeURIComponent(nextPath)}${
        inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ''
      }`
    : '/register';

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      {/* The product's own mark, not an emoji: it swaps for dark mode by itself. */}
      <div className="lumio-auth-logo" role="img" aria-label="Lumio" />

      <Typography component="h1" className="lumio-auth-title">
        {t.title}
      </Typography>

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
            slotProps={{ htmlInput: { 'aria-describedby': error ? 'login-error' : undefined } }}
          />
        </div>
        <div className="lumio-auth-field">
          <div className="lumio-auth-field__head">
            <label htmlFor="password" className="lumio-auth-field__label">
              {t.passwordLabel}
            </label>
            <NextLink href="/forgot-password" className="lumio-auth-link">
              {t.forgotPassword}
            </NextLink>
          </div>
          <TextField
            required
            fullWidth
            name="password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={Boolean(error)}
            slotProps={{
              htmlInput: { 'aria-describedby': error ? 'login-error' : undefined },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={(showPassword ? t.hidePassword : t.showPassword).value}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(prev => !prev)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {error && !twoFactorRequired ? (
            <p id="login-error" role="alert" className="lumio-auth-error">
              {error}
            </p>
          ) : null}
        </div>
        {twoFactorRequired && (
          <div className="lumio-auth-field">
            <label htmlFor="twoFactorCode" className="lumio-auth-field__label">
              {t.twoFactorLabel}
            </label>
            <TextField
              required
              fullWidth
              id="twoFactorCode"
              name="twoFactorCode"
              autoComplete="one-time-code"
              autoFocus
              value={twoFactorCode}
              onChange={e => setTwoFactorCode(e.target.value)}
              error={Boolean(error)}
            />
            {error ? (
              <p id="login-error" role="alert" className="lumio-auth-error">
                {error}
              </p>
            ) : (
              <p className="lumio-auth-field__hint">{t.twoFactorHint}</p>
            )}
          </div>
        )}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          className="lumio-auth-submit"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : t.submit}
        </Button>
        <p className="lumio-auth-footnote">
          {t.noAccountPrompt}{' '}
          <NextLink href={registerHref} className="lumio-auth-link lumio-auth-link--accent">
            {t.signUp}
          </NextLink>
        </p>
      </Box>
    </AuthLayout>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
