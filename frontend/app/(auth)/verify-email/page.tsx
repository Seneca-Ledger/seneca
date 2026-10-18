'use client';

import { CircularProgress, Typography } from '@mui/material';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { Check } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { AuthHero } from '../AuthHero';
import AuthLayout from '../AuthLayout';

type Status = 'checking' | 'confirmed' | 'failed';

function VerifyEmailContent(): React.JSX.Element {
  const t = useIntlayer('verifyEmailPage');
  const tl = useIntlayer('loginPage');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError(t.missingToken.value);
      setStatus('failed');
      return;
    }

    apiClient
      .post('/users/me/email/confirm', { token } satisfies ContractInput<'ConfirmEmailChangeBody'>)
      .then(() => {
        setStatus('confirmed');
      })
      .catch((err: unknown) => {
        setError(getApiErrorMessage(err, t.genericError.value));
        setStatus('failed');
      });
  }, [token, t.missingToken.value, t.genericError.value]);

  const sideContent = <AuthHero tagline={tl.rightTagline} />;

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      <div className="lumio-auth-logo" role="img" aria-label="Lumio" />
      <Typography component="h1" className="lumio-auth-title">
        {t.title}
      </Typography>

      {status === 'checking' && (
        <p role="status" className="lumio-auth-notice lumio-auth-notice--plain">
          <CircularProgress size={16} color="inherit" />
          <span>{t.checking}</span>
        </p>
      )}

      {status === 'confirmed' && (
        <p role="status" className="lumio-auth-notice">
          <Check size={18} aria-hidden />
          <span>{t.success}</span>
        </p>
      )}

      {status === 'failed' && (
        <p role="alert" className="lumio-auth-error lumio-auth-error--block">
          {error}
        </p>
      )}

      <p className="lumio-auth-footnote">
        <NextLink href="/login" className="lumio-auth-link lumio-auth-link--accent">
          {t.backToLogin}
        </NextLink>
      </p>
    </AuthLayout>
  );
}

export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
