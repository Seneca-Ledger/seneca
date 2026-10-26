'use client';

import { useAuth } from '@/app/hooks/useAuth';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';

/**
 * Records that the tutorial was closed, so it stops opening by itself. The local
 * user is updated first; the server's timestamp replaces it when it arrives.
 */
export function useMarkWelcomeTutorialSeen(): () => void {
  const { user, setUser } = useAuth();

  return () => {
    // Already recorded: it was reopened from the avatar menu.
    if (user?.welcomeTutorialSeenAt != null) {
      return;
    }
    const stamp = (seenAt: string): void =>
      setUser(current => (current ? { ...current, welcomeTutorialSeenAt: seenAt } : current));
    stamp(new Date().toISOString());
    apiClient
      .post('/users/me/welcome-tutorial')
      .then(response =>
        checkContract('WelcomeTutorialSeen', response.data, '/users/me/welcome-tutorial'),
      )
      .then(({ welcomeTutorialSeenAt }) => {
        if (welcomeTutorialSeenAt) stamp(welcomeTutorialSeenAt);
      })
      // Nothing to recover: the tutorial is closed either way, and without the
      // server's record it simply opens once more in the next session.
      .catch(() => undefined);
  };
}
