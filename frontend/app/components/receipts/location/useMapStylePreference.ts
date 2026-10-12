'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';

type UseMapStylePreferenceResult = {
  preference: string | null;
  setPreference: (styleId: string) => Promise<void>;
};

/**
 * The picked style lives on the user profile, so it follows them to other
 * devices. Applied optimistically: the map switches on click and rolls back if
 * the save fails.
 */
export function useMapStylePreference(): UseMapStylePreferenceResult {
  const { user, setUser } = useAuth();
  const t = useIntlayer('receiptLocation');

  const setPreference = useCallback(
    async (styleId: string) => {
      const previousUser = user;
      if (!previousUser || previousUser.mapStylePreference === styleId) {
        return;
      }

      const optimisticUser = { ...previousUser, mapStylePreference: styleId };
      setUser(optimisticUser);
      localStorage.setItem('user', JSON.stringify(optimisticUser));

      await apiClient
        .patch('/users/me/preferences', {
          mapStylePreference: styleId,
        } satisfies ContractInput<'UpdateMyPreferencesBody'>)
        .catch(async () => {
          setUser(previousUser);
          localStorage.setItem('user', JSON.stringify(previousUser));
          toast.error(t.styleSaveFailed.value);
        });
    },
    [user, setUser, t],
  );

  return { preference: user?.mapStylePreference ?? null, setPreference };
}
