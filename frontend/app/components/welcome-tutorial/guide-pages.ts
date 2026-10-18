import { isNavItemActive } from '@/app/components/navigation/helpers/navigation-config';
import type { User } from '@/app/contexts/AuthContext';
import { TUTORIAL_PAGES, type TutorialStepId } from './welcome-tutorial-routes';

/**
 * The first visit to a sidebar page opens the guide on that page, once. The server
 * keeps, per page, the version the person closed it at (`users.page_hints_seen`);
 * raising this shows every page once more. 2: the guide pages replaced the small
 * hint cards of version 1.
 */
export const GUIDE_PAGE_VERSION = 2;

/** The guide page about the sidebar page at `pathname`, if the guide has one. */
export function guidePageFor(pathname: string): TutorialStepId | null {
  return TUTORIAL_PAGES.find(page => isNavItemActive(pathname, page.path))?.id ?? null;
}

/**
 * After onboarding and the welcome window, and only when the server's record is
 * known: a user object without `pageHintsSeen` (an older cached copy) must never
 * read as "nothing seen yet".
 */
export function isGuidePageDue(user: User | null, page: TutorialStepId): boolean {
  if (
    !user?.onboardingCompletedAt ||
    typeof user.welcomeTutorialSeenAt !== 'string' ||
    user.pageHintsSeen === undefined
  ) {
    return false;
  }
  return (user.pageHintsSeen[page] ?? 0) < GUIDE_PAGE_VERSION;
}
