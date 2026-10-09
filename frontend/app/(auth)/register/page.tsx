/* eslint-disable max-lines */
'use client';

import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import MuiLink from '@mui/material/Link';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
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

const MIN_PASSWORD_LENGTH = 8;

// eslint-disable-next-line max-lines-per-function, complexity
function RegisterPageContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get('next'));
  const inviteToken = searchParams.get('invite');
  const presetEmail = searchParams.get('email');
  const t = useIntlayer('registerPage');
  const [formData, setFormData] = useState({
    email: presetEmail || '',
    password: '',
    name: '',
    company: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailLocked, setEmailLocked] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.name === 'email' && emailLocked) {
      return;
    }
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  useEffect(() => {
    if (!inviteToken) {
      return;
    }

    setInviteLoading(true);
    apiClient
      .get(`/workspaces/invitations/${inviteToken}`)
      .then(response => {
        const email = response.data?.email;
        if (typeof email === 'string' && email.trim()) {
          setFormData(prev => ({ ...prev, email }));
          setEmailLocked(true);
        }
      })
      .catch((error: unknown) => {
        setError(getApiErrorMessage(error, t.inviteLoadFailed.value));
      })
      .finally(() => {
        setInviteLoading(false);
      });
  }, [inviteToken, t.inviteLoadFailed.value]);

  // eslint-disable-next-line max-lines-per-function
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      setError(t.passwordHelper.value);
      return;
    }

    setLoading(true);

    return await (async () => {
      const response = await apiClient.post('/auth/register', {
        ...formData,
        invitationToken: inviteToken || undefined,
      });

      const { user } = response.data;

      localStorage.setItem('user', JSON.stringify(user));
      syncLocaleFromUser(user);
      if (user.workspaceId) {
        localStorage.setItem('currentWorkspaceId', user.workspaceId);
      }

      if (inviteToken) {
        window.location.href = nextPath || DEFAULT_APP_ROUTE;
        return;
      }

      window.location.href = '/onboarding';
    })()
      .catch(async (error: unknown) => {
        setError(getApiErrorMessage(error, t.registerFailed.value));
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  const sideContent = <AuthHero title={t.rightTitle} tagline={t.rightTagline} />;

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
          id="name"
          label={t.fullNameLabel.value}
          name="name"
          autoComplete="name"
          autoFocus
          value={formData.name}
          onChange={handleChange}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label={t.emailLabel.value}
          name="email"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          disabled={emailLocked || inviteLoading}
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
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          helperText={t.passwordHelper.value}
          inputProps={{ minLength: MIN_PASSWORD_LENGTH }}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="normal"
          fullWidth
          id="company"
          label={t.companyLabel.value}
          name="company"
          value={formData.company}
          onChange={handleChange}
          sx={{ mb: 3 }}
        />
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
          disabled={loading || inviteLoading}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : t.submit}
        </Button>
        <Box textAlign="center" sx={{ mt: 3 }}>
          <MuiLink
            component={NextLink}
            href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
            variant="body2"
            sx={{
              textDecoration: 'none',
              fontWeight: 600,
              color: 'primary.main',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t.haveAccount}
          </MuiLink>
        </Box>
      </Box>
    </AuthLayout>
  );
}

export default function RegisterPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
