'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isPageCovered } from '@/app/components/page-hints/page-hints-dom';
import { useAuth } from '@/app/hooks/useAuth';
import { guidePageFor, isGuidePageDue } from './guide-pages';
import { useTutorialSteps } from './useTutorialSteps';
import { openGuidePage, useWelcomeTutorialView } from './welcome-tutorial-store';

// Lets the page under it paint first.
const AUTO_OPEN_DELAY_MS = 600;

/**
 * On the first visit to a sidebar page, opens the guide on that page alone. Never
 * over another window: when something modal is open by then (the upload dialog the
 * welcome window leads to), the page waits for the next visit.
 */
export function useGuidePageAutoOpen(): void {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const view = useWelcomeTutorialView();
  // Only pages the person has in the sidebar: a hidden page has no guide page either.
  const steps = useTutorialSteps();
  const page = !loading && pathname ? guidePageFor(pathname) : null;
  const due =
    page !== null &&
    view === null &&
    steps.some(step => step.id === page) &&
    isGuidePageDue(user, page);

  useEffect(() => {
    if (!due || page === null) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (!isPageCovered()) {
        openGuidePage(page);
      }
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [due, page]);
}
