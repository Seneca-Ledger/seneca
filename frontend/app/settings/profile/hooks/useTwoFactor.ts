'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

export type TwoFactorStatus = {
  enabled: boolean;
  pendingSetup: boolean;
  recoveryCodesRemaining: number;
};

export type TwoFactorSetup = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
};

export type UseTwoFactorMessages = {
  loadError: string;
  enabledMessage: string;
  disabledMessage: string;
  errorFallback: string;
};

export type UseTwoFactorReturn = {
  status: TwoFactorStatus | null;
  setup: TwoFactorSetup | null;
  recoveryCodes: string[] | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  startSetup: (password: string) => Promise<void>;
  confirmSetup: (code: string) => Promise<void>;
  disable: (password: string) => Promise<void>;
  regenerateRecoveryCodes: (password: string) => Promise<void>;
  cancelSetup: () => void;
  dismissRecoveryCodes: () => void;
};

export function useTwoFactor(
  isAuthenticated: boolean,
  messages: UseTwoFactorMessages,
): UseTwoFactorReturn {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    await (async () => {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<TwoFactorStatus>('/auth/2fa');
      setStatus(response.data);
    })()
      .catch(async (err: unknown) => {
        setError(getApiErrorMessage(err, messages.loadError));
      })
      .finally(async () => {
        setLoading(false);
      });
  }, [messages.loadError]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadStatus();
  }, [isAuthenticated, loadStatus]);

  /** Every action shares the same guard: clear feedback, run, refresh status. */
  const run = useCallback(
    async (action: () => Promise<void>) => {
      await (async () => {
        setBusy(true);
        setError(null);
        setMessage(null);
        await action();
        await loadStatus();
      })()
        .catch(async (err: unknown) => {
          setError(getApiErrorMessage(err, messages.errorFallback));
        })
        .finally(async () => {
          setBusy(false);
        });
    },
    [loadStatus, messages.errorFallback],
  );

  const startSetup = useCallback(
    (password: string) =>
      run(async () => {
        const response = await apiClient.post<TwoFactorSetup>('/auth/2fa/setup', {
          password,
        } satisfies ContractInput<'TwoFactorPasswordBody'>);
        setSetup(response.data);
      }),
    [run],
  );

  const confirmSetup = useCallback(
    (code: string) =>
      run(async () => {
        const response = await apiClient.post<{ recoveryCodes: string[] }>('/auth/2fa/enable', {
          code: code.trim(),
        } satisfies ContractInput<'TwoFactorCodeBody'>);
        setSetup(null);
        setRecoveryCodes(response.data.recoveryCodes);
        setMessage(messages.enabledMessage);
      }),
    [messages.enabledMessage, run],
  );

  const disable = useCallback(
    (password: string) =>
      run(async () => {
        await apiClient.post('/auth/2fa/disable', {
          password,
        } satisfies ContractInput<'TwoFactorPasswordBody'>);
        setSetup(null);
        setRecoveryCodes(null);
        setMessage(messages.disabledMessage);
      }),
    [messages.disabledMessage, run],
  );

  const regenerateRecoveryCodes = useCallback(
    (password: string) =>
      run(async () => {
        const response = await apiClient.post<{ recoveryCodes: string[] }>(
          '/auth/2fa/recovery-codes',
          { password } satisfies ContractInput<'TwoFactorPasswordBody'>,
        );
        setRecoveryCodes(response.data.recoveryCodes);
      }),
    [run],
  );

  const cancelSetup = useCallback(() => {
    setSetup(null);
    setError(null);
  }, []);

  const dismissRecoveryCodes = useCallback(() => setRecoveryCodes(null), []);

  return {
    status,
    setup,
    recoveryCodes,
    loading,
    busy,
    error,
    message,
    startSetup,
    confirmSetup,
    disable,
    regenerateRecoveryCodes,
    cancelSetup,
    dismissRecoveryCodes,
  };
}
