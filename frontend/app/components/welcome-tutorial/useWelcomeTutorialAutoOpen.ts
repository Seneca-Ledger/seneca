'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { isWelcomeTutorialEligible } from './welcome-tutorial-routes';
import { claimAutoOpen, openWelcome } from './welcome-tutorial-store';

// Lets the page under it paint first.
const AUTO_OPEN_DELAY_MS = 600;

/** Opens the welcome window by itself once, for a new account on one of the sidebar pages. */
export function useWelcomeTutorialAutoOpen(): void {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const eligible = isWelcomeTutorialEligible({ user, loading, pathname });

  useEffect(() => {
    if (!eligible) {
      return undefined;
    }
    // The claim sits inside the timer, so an effect cancelled before it fires
    // does not use up the one automatic opening.
    const timer = window.setTimeout(() => {
      if (claimAutoOpen()) {
        openWelcome();
      }
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [eligible]);
}
