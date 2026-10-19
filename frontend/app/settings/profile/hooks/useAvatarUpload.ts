'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@/app/hooks/useAuth';
import apiClient from '@/app/lib/api';
import { MAX_AVATAR_SIZE_BYTES } from '@/app/lib/constants';
import { checkContract } from '@/app/lib/query-fn-schema';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

export type UseAvatarUploadMessages = {
  sizeError: string;
  updated: string;
  errorFallback: string;
};

export type UseAvatarUploadReturn = {
  avatarError: boolean;
  setAvatarError: (value: boolean) => void;
  avatarUploading: boolean;
  avatarMessage: string | null;
  avatarErrorMessage: string | null;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  handleAvatarSelect: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
};

export function useAvatarUpload(
  user: User | null | undefined,
  setUser: (user: User) => void,
  messages: UseAvatarUploadMessages,
): UseAvatarUploadReturn {
  const [avatarError, setAvatarError] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarErrorMessage, setAvatarErrorMessage] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarMessage(null);
    setAvatarErrorMessage(null);

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarErrorMessage(messages.sizeError);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
      return;
    }

    setAvatarUploading(true);

    await (async () => {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await apiClient.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { user: updatedUser } = await checkContract(
        'UserUpdateResponse',
        response.data,
        '/users/me/avatar',
      );
      const nextUser = updatedUser || user;
      if (nextUser) {
        setUser(nextUser);
        localStorage.setItem('user', JSON.stringify(nextUser));
      }
      setAvatarMessage(messages.updated);
    })()
      .catch(async (error: unknown) => {
        setAvatarErrorMessage(getApiErrorMessage(error, messages.errorFallback));
      })
      .finally(async () => {
        setAvatarUploading(false);
        if (avatarInputRef.current) {
          avatarInputRef.current.value = '';
        }
      });
  };

  return {
    avatarError,
    setAvatarError,
    avatarUploading,
    avatarMessage,
    avatarErrorMessage,
    avatarInputRef,
    handleAvatarSelect,
  };
}
