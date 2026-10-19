'use client';

import { type AuthContextValue, useAuthContext } from '@/app/contexts/AuthContext';

export type { User } from '@/app/contexts/AuthContext';

/** Shared auth state; see AuthProvider for the single `/auth/me` load. */
export function useAuth(): AuthContextValue {
  return useAuthContext();
}
