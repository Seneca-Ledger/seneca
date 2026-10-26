'use client';

import { Box, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { BrandLockup } from '@/app/components/BrandLockup';
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

const MIN_PASSWORD_LENGTH = 8;

function RegisterPageContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get('next'));
  const inviteToken = searchParams.get('invite');
  const presetEmail = searchParams.get('email');
  const t = useIntlayer('registerPage');
  // The show/hide password labels are the login page's: one wording for both.
  const tl = useIntlayer('loginPage');
  const [showPassword, setShowPassword] = useState(false);
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
      .then(response =>
        checkContract('InvitationPreview', response.data, '/workspaces/invitations/:token'),
      )
      .then(({ email }) => {
        if (email.trim()) {
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
      } satisfies ContractInput<'RegisterBody'>);

      const { user } = await checkContract('RegisterResponse', response.data, '/auth/register');

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

  // The logo names the product; the right half says what it does for you.
  const sideContent = <AuthHero tagline={t.rightTagline} />;
  // A too-short password is told under its own field, in place of the hint.
  const passwordError = error !== '' && error === t.passwordHelper.value;
  const formError = error !== '' && !passwordError;

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      {/* The product's own mark, not an emoji: it swaps for dark mode by itself. */}
      <BrandLockup className="seneca-auth-logo" />

      <Typography component="h1" className="seneca-auth-title">
        {t.title}
      </Typography>

      <Box
        component="form"
        onSubmit={handleSubmit}
        className="seneca-auth-form"
        sx={{ width: '100%' }}
      >
        <div className="seneca-auth-field">
          <label htmlFor="name" className="seneca-auth-field__label">
            {t.fullNameLabel}
          </label>
          <TextField
            required
            fullWidth
            id="name"
            name="name"
            autoComplete="name"
            autoFocus
            value={formData.name}
            onChange={handleChange}
          />
        </div>
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
            value={formData.email}
            onChange={handleChange}
            disabled={emailLocked || inviteLoading}
          />
        </div>
        <div className="seneca-auth-field">
          <label htmlFor="password" className="seneca-auth-field__label">
            {t.passwordLabel}
          </label>
          <TextField
            required
            fullWidth
            name="password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            error={passwordError}
            slotProps={{
              htmlInput: { minLength: MIN_PASSWORD_LENGTH, 'aria-describedby': 'password-hint' },
              input: {
                endAdornment: (
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
                ),
              },
            }}
          />
          <p
            id="password-hint"
            role={passwordError ? 'alert' : undefined}
            className={passwordError ? 'seneca-auth-error' : 'seneca-auth-field__hint'}
          >
            {t.passwordHelper}
          </p>
        </div>
        <div className="seneca-auth-field">
          <label htmlFor="company" className="seneca-auth-field__label">
            {t.companyLabel}
          </label>
          <TextField
            fullWidth
            id="company"
            name="company"
            autoComplete="organization"
            value={formData.company}
            onChange={handleChange}
          />
        </div>
        {formError ? (
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
          disabled={loading || inviteLoading}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : t.submit}
        </Button>
        <p className="seneca-auth-footnote">
          {t.haveAccountPrompt}{' '}
          <NextLink
            href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
            className="seneca-auth-link seneca-auth-link--accent"
          >
            {t.logIn}
          </NextLink>
        </p>
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
