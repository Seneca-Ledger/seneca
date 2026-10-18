'use client';

import type { User } from '@/app/contexts/AuthContext';
import { useAuth } from '@/app/hooks/useAuth';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

type Seen = Readonly<Record<string, number>>;

/** Per page, the higher of two versions: an answer to an older close cannot undo a newer one. */
export function mergeSeen(local: Seen | undefined, server: Seen): Record<string, number> {
  const merged: Record<string, number> = { ...local };
  for (const [page, version] of Object.entries(server)) {
    merged[page] = Math.max(merged[page] ?? 0, version);
  }
  return merged;
}

const withSeen =
  (seen: Seen) =>
  (current: User | null): User | null =>
    current ? { ...current, pageHintsSeen: mergeSeen(current.pageHintsSeen, seen) } : current;

/**
 * Records that the hints of `page` were closed up to `version`. The local user is
 * updated first, so the hints do not come back while the request is on its way;
 * the server's map is merged in when it arrives, never replacing the user.
 */
export function useMarkPageHintsSeen(): (page: string, version: number) => void {
  const { setUser } = useAuth();

  return (page, version) => {
    setUser(withSeen({ [page]: version }));
    apiClient
      .post('/users/me/page-hints', { page, version } satisfies ContractInput<'PageHintsSeenBody'>)
      .then(response => checkContract('PageHintsSeen', response.data, '/users/me/page-hints'))
      .then(({ pageHintsSeen }) => setUser(withSeen(pageHintsSeen)))
      // Nothing to recover: the hints are closed either way, and without the
      // server's record they show once more in the next session.
      .catch(() => undefined);
  };
}
