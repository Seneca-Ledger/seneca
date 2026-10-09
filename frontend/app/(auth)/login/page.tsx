/* eslint-disable max-lines */
'use client';

import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import MuiLink from '@mui/material/Link';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { AuthGreeting } from '@/app/components/AuthGreeting';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import { syncLocaleFromUser } from '@/app/lib/locale';
import { safeInternalPath } from '@/app/lib/safe-path';
import { tokens } from '@/lib/theme-tokens';
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
      });

      // Password was right, but the account also needs a second factor.
      if (response.data?.twoFactorRequired) {
        setTwoFactorRequired(true);
        return;
      }

      // Токены пришли httpOnly-куками и в теле ответа их больше нет —
      // хранить тут нечего, кроме профиля для первого рендера.
      const { user } = response.data;

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

  const sideContent = <AuthHero title={'Lumio'} tagline={t.rightTagline} />;

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      {/* The product's own mark, not an emoji: it swaps for dark mode by itself. */}
      <div className="lumio-auth-logo" role="img" aria-label="Lumio" />

      <AuthGreeting />

      <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
        {t.subtitle}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label={t.emailLabel.value}
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          InputProps={{
            sx: { borderRadius: tokens.radius.md },
          }}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label={t.passwordLabel.value}
          type="password"
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          InputProps={{
            sx: { borderRadius: tokens.radius.md },
          }}
          sx={{ mb: twoFactorRequired ? 2 : 3 }}
        />
        {twoFactorRequired && (
          <TextField
            margin="normal"
            required
            fullWidth
            id="twoFactorCode"
            name="twoFactorCode"
            label={t.twoFactorLabel.value}
            helperText={t.twoFactorHint.value}
            autoComplete="one-time-code"
            autoFocus
            value={twoFactorCode}
            onChange={e => setTwoFactorCode(e.target.value)}
            InputProps={{
              sx: { borderRadius: tokens.radius.md },
            }}
            sx={{ mb: 3 }}
          />
        )}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          sx={{
            py: 1.5,
            borderRadius: tokens.radius.full,
            fontSize: '1rem',
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : t.submit}
        </Button>
        <Box textAlign="center" sx={{ mt: 2 }}>
          <MuiLink
            component={NextLink}
            href="/forgot-password"
            variant="body2"
            sx={{
              textDecoration: 'none',
              color: 'text.secondary',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t.forgotPassword}
          </MuiLink>
        </Box>
        <Box textAlign="center" sx={{ mt: 2 }}>
          <MuiLink
            component={NextLink}
            href={
              nextPath
                ? `/register?next=${encodeURIComponent(nextPath)}${
                    inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ''
                  }`
                : '/register'
            }
            variant="body2"
            sx={{
              textDecoration: 'none',
              fontWeight: 600,
              color: 'primary.main',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t.noAccount}
          </MuiLink>
        </Box>
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
