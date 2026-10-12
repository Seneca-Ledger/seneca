'use client';

import { useState } from 'react';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

export type UsePasswordFormMessages = {
  mismatch: string;
  confirmSubmit: string;
  successFallback: string;
  errorFallback: string;
};

export type UsePasswordFormReturn = {
  passwords: { current: string; next: string; confirm: string };
  setPasswords: (value: { current: string; next: string; confirm: string }) => void;
  passwordMessage: string | null;
  passwordError: string | null;
  passwordLoading: boolean;
  handlePasswordSubmit: (event: React.FormEvent) => Promise<void>;
};

export function usePasswordForm(messages: UsePasswordFormMessages): UsePasswordFormReturn {
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (passwords.next !== passwords.confirm) {
      setPasswordError(messages.mismatch);
      return;
    }

    if (!window.confirm(messages.confirmSubmit)) {
      return;
    }

    await (async () => {
      setPasswordLoading(true);
      const response = await apiClient.patch('/users/me/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      } satisfies ContractInput<'ChangePasswordBody'>);

      setPasswordMessage(response.data?.message || messages.successFallback);
      setPasswords({ current: '', next: '', confirm: '' });
    })()
      .catch(async (error: unknown) => {
        setPasswordError(getApiErrorMessage(error, messages.errorFallback));
      })
      .finally(async () => {
        setPasswordLoading(false);
      });
  };

  return {
    passwords,
    setPasswords,
    passwordMessage,
    passwordError,
    passwordLoading,
    handlePasswordSubmit,
  };
}
