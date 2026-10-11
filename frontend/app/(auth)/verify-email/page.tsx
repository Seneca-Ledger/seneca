'use client';

import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import MuiLink from '@mui/material/Link';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { AuthLanguageSwitcher } from '@/app/components/AuthLanguageSwitcher';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import AuthLayout from '../AuthLayout';

type Status = 'checking' | 'confirmed' | 'failed';

function VerifyEmailContent(): React.JSX.Element {
  const t = useIntlayer('verifyEmailPage');
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
    </Box>
  );

  return (
    <AuthLayout sideContent={sideContent} topRightAction={<AuthLanguageSwitcher />}>
      <Typography variant="h4" fontWeight="bold" align="center" sx={{ mb: 4 }}>
        {t.title}
      </Typography>

      {status === 'checking' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <CircularProgress size={20} />
          <Typography variant="body1" color="text.secondary">
            {t.checking}
          </Typography>
        </Box>
      )}

      {status === 'confirmed' && (
        <Alert severity="success" sx={{ mb: 3, width: '100%' }}>
          {t.success}
        </Alert>
      )}

      {status === 'failed' && (
        <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
          {error}
        </Alert>
      )}

      <Typography variant="body2" align="center">
        <MuiLink component={NextLink} href="/login" underline="hover">
          {t.backToLogin}
        </MuiLink>
      </Typography>
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
