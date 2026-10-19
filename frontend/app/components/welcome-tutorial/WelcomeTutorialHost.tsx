'use client';

import dynamic from 'next/dynamic';
import type React from 'react';
import { useState } from 'react';
import { useMarkPageHintsSeen } from '@/app/components/page-hints/useMarkPageHintsSeen';
import { GUIDE_PAGE_VERSION } from './guide-pages';
import { useGuidePageAutoOpen } from './useGuidePageAutoOpen';
import { useMarkWelcomeTutorialSeen } from './useMarkWelcomeTutorialSeen';
import { useWelcomeTutorialAutoOpen } from './useWelcomeTutorialAutoOpen';
import {
  closeWelcomeTutorial,
  useGuidePage,
  useWelcomeTutorialView,
} from './welcome-tutorial-store';

// Each window loads only once it is opened.
const WelcomeWindow = dynamic(() => import('@/app/components/welcome-window/WelcomeWindow'), {
  ssr: false,
});
const WelcomeTutorialDialog = dynamic(() => import('./WelcomeTutorialDialog'), { ssr: false });

/**
 * Counts the openings. Each one starts a fresh window; after closing, the window
 * stays mounted so that its exit transition can play.
 */
function useOpenings(open: boolean): number {
  const [session, setSession] = useState({ open: false, count: 0 });
  if (open !== session.open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
  }
  return session.count;
}

/**
 * Mounted once in the root layout. Opens the welcome window by itself for a new
 * account, the guide's page about a sidebar page on the first visit to it, and the
 * whole guide whenever Settings asks for it.
 */
export function WelcomeTutorialHost(): React.JSX.Element {
  const view = useWelcomeTutorialView();
  const page = useGuidePage();
  const markSeen = useMarkWelcomeTutorialSeen();
  const markPageSeen = useMarkPageHintsSeen();
  const welcomeOpenings = useOpenings(view === 'welcome');
  const guideOpenings = useOpenings(view === 'guide');
  useWelcomeTutorialAutoOpen();
  useGuidePageAutoOpen();

  // Any way out of either window counts as seen: the welcome window does not come back.
  // A page opened on a first visit is seen however it is left, even after "Whole guide".
  const handleClose = (): void => {
    closeWelcomeTutorial();
    markSeen();
    if (page) {
      markPageSeen(page, GUIDE_PAGE_VERSION);
    }
  };
  return (
    <>
      {welcomeOpenings > 0 && (
        <WelcomeWindow key={welcomeOpenings} open={view === 'welcome'} onClose={handleClose} />
      )}
      {guideOpenings > 0 && (
        <WelcomeTutorialDialog
          key={guideOpenings}
          open={view === 'guide'}
          page={page}
          onClose={handleClose}
        />
      )}
    </>
  );
}
