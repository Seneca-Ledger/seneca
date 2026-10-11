'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@/app/hooks/useAuth';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import type { DateFormatPreference } from '@/app/lib/user-format';
import { notifyUserFormatChanged } from '@/app/lib/user-format-store';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

export type UseProfileFormMessages = {
  successFallback: string;
  errorFallback: string;
};

export type UseProfileFormReturn = {
  profileName: string;
  setProfileName: (value: string) => void;
  profileTimeZone: string;
  setProfileTimeZone: (value: string) => void;
  profileDateFormat: DateFormatPreference;
  setProfileDateFormat: (value: DateFormatPreference) => void;
  profileFirstDayOfWeek: number | null;
  setProfileFirstDayOfWeek: (value: number | null) => void;
  profileMessage: string | null;
  setProfileMessage: (value: string | null) => void;
  profileError: string | null;
  setProfileError: (value: string | null) => void;
  profileLoading: boolean;
  hasProfileChanges: boolean;
  handleProfileSubmit: (event: React.FormEvent) => Promise<void>;
};

export function useProfileForm(
  user: User | null | undefined,
  setUser: (user: User) => void,
  messages: UseProfileFormMessages,
): UseProfileFormReturn {
  const [profileName, setProfileName] = useState('');
  const [profileTimeZone, setProfileTimeZone] = useState<string>('');
  const [profileDateFormat, setProfileDateFormat] = useState<DateFormatPreference>('auto');
  const [profileFirstDayOfWeek, setProfileFirstDayOfWeek] = useState<number | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (user?.name) setProfileName(user.name as string);
    setProfileTimeZone(user?.timeZone ? (user.timeZone as string) : '');
    setProfileDateFormat(user?.dateFormat ?? 'auto');
    setProfileFirstDayOfWeek(user?.firstDayOfWeek ?? null);
  }, [user]);

  const hasProfileChanges = useMemo(() => {
    return (
      profileName.trim() !== ((user?.name as string) || '').trim() ||
      profileTimeZone !== ((user?.timeZone as string) || '') ||
      profileDateFormat !== (user?.dateFormat ?? 'auto') ||
      profileFirstDayOfWeek !== (user?.firstDayOfWeek ?? null)
    );
  }, [
    profileName,
    profileTimeZone,
    profileDateFormat,
    profileFirstDayOfWeek,
    user?.name,
    user?.timeZone,
    user?.dateFormat,
    user?.firstDayOfWeek,
  ]);

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    const normalizedName = profileName.trim();
    if (!hasProfileChanges) return;

    await (async () => {
      setProfileLoading(true);
      const response = await apiClient.patch('/users/me/preferences', {
        name: normalizedName,
        timeZone: profileTimeZone ? profileTimeZone : null,
        dateFormat: profileDateFormat,
        firstDayOfWeek: profileFirstDayOfWeek,
      } satisfies ContractInput<'UpdateMyPreferencesBody'>);

      const responseUser = response.data?.user;
      const nextUser = responseUser
        ? { ...(user || {}), ...responseUser }
        : user
          ? {
              ...user,
              name: normalizedName,
              timeZone: profileTimeZone || null,
              dateFormat: profileDateFormat,
              firstDayOfWeek: profileFirstDayOfWeek,
            }
          : null;

      if (nextUser) {
        setUser(nextUser as User);
        localStorage.setItem('user', JSON.stringify(nextUser));
        notifyUserFormatChanged();
      }

      setProfileMessage(response.data?.message || messages.successFallback);
    })()
      .catch(async (error: unknown) => {
        setProfileError(getApiErrorMessage(error, messages.errorFallback));
      })
      .finally(async () => {
        setProfileLoading(false);
      });
  };

  return {
    profileName,
    setProfileName,
    profileTimeZone,
    setProfileTimeZone,
    profileDateFormat,
    setProfileDateFormat,
    profileFirstDayOfWeek,
    setProfileFirstDayOfWeek,
    profileMessage,
    setProfileMessage,
    profileError,
    setProfileError,
    profileLoading,
    hasProfileChanges,
    handleProfileSubmit,
  };
}
