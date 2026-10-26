'use client';

import { Box, Stack, Typography } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { Suspense, useEffect, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { BANK_SYNC_BASE } from '../types';

/**
 * Where the bank sends the user back after they authorize access. The code is
 * only worth anything together with the state we handed out before the
 * redirect, which the server checks as well.
 */
function BankSyncCallback(): React.JSX.Element {
  const t = useIntlayer('bankSyncPanel');
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    const stored = window.sessionStorage.getItem('bankSyncPendingLink');
    const pending = stored ? (JSON.parse(stored) as { connectionId: string; state: string }) : null;

    if (!(code && state && pending) || pending.state !== state) {
      setError(t.callbackMismatch.value);
      return;
    }

    void apiClient
      .post(`${BANK_SYNC_BASE}/connections/${pending.connectionId}/links/complete`, {
        code,
        state,
      } satisfies ContractInput<'CompleteBankSyncLinkBody'>)
      .then(() => {
        window.sessionStorage.removeItem('bankSyncPendingLink');
        router.replace('/integrations');
      })
      .catch((caught: unknown) => {
        setError(`${t.authorizeFailed.value}: ${getApiErrorMessage(caught)}`);
      });
  }, [params, router, t.authorizeFailed.value, t.callbackMismatch.value]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
      <Stack spacing={2} sx={{ alignItems: 'center' }} data-testid="bank-sync-callback">
        {error ? (
          <Typography role="alert" sx={{ fontSize: 14, color: 'error.main' }}>
            {error}
          </Typography>
        ) : (
          <Typography role="status" sx={{ fontSize: 14, color: 'text.secondary' }}>
            {t.finishingAuthorization}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

/** `useSearchParams` needs a Suspense boundary so the static shell can prerender. */
export default function BankSyncCallbackPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <BankSyncCallback />
    </Suspense>
  );
}
