'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/app/hooks/useAuth';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

export type UseEmailFormMessages = {
  passwordRequired: string;
  successFallback: string;
  errorFallback: string;
};

export type UseEmailFormReturn = {
  email: string;
  setEmail: (value: string) => void;
  emailPassword: string;
  setEmailPassword: (value: string) => void;
  emailMessage: string | null;
  emailError: string | null;
  emailLoading: boolean;
  handleEmailSubmit: (event: React.FormEvent) => Promise<void>;
};

export function useEmailForm(
  user: User | null | undefined,
  messages: UseEmailFormMessages,
): UseEmailFormReturn {
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email as string);
  }, [user?.email]);

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailMessage(null);
    setEmailError(null);

    if (!emailPassword) {
      setEmailError(messages.passwordRequired);
      return;
    }

    await (async () => {
      setEmailLoading(true);
      const response = await apiClient.patch('/users/me/email', {
        email,
        currentPassword: emailPassword,
      } satisfies ContractInput<'ChangeEmailBody'>);

      // The server's sentence: the address changes only once the emailed link is opened.
      const { message } = await checkContract('MessageResult', response.data, '/users/me/email');
      setEmailMessage(message);
      setEmailPassword('');
    })()
      .catch(async (error: unknown) => {
        setEmailError(getApiErrorMessage(error, messages.errorFallback));
      })
      .finally(async () => {
        setEmailLoading(false);
      });
  };

  return {
    email,
    setEmail,
    emailPassword,
    setEmailPassword,
    emailMessage,
    emailError,
    emailLoading,
    handleEmailSubmit,
  };
}
