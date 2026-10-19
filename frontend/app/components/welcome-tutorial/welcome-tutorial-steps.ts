import type { ReactElement, ReactNode } from 'react';
import type { NavItem } from '@/app/components/navigation/helpers/navigation-config';
import { TUTORIAL_PAGES, type TutorialStepId } from './welcome-tutorial-routes';
import { TUTORIAL_SCREENS, type TutorialFragment } from './welcome-tutorial-screens';

export interface TutorialStep {
  id: TutorialStepId;
  path: string;
  /** The sidebar label, as a node for rendering. */
  label: ReactNode;
  /** The same label as plain text, for attributes. */
  title: string;
  icon: ReactElement;
  fragments: TutorialFragment[];
}

/**
 * One step per page the user actually has in the sidebar, in sidebar order: a page
 * the sidebar hides (no permission, experimental) is not explained either.
 */
export function buildTutorialSteps(
  visibleNavItems: NavItem[],
  titleOf: (id: TutorialStepId) => string,
): TutorialStep[] {
  return TUTORIAL_PAGES.flatMap(page => {
    const item = visibleNavItems.find(navItem => navItem.path === page.path);
    if (!item) {
      return [];
    }
    return [
      {
        id: page.id,
        path: page.path,
        label: item.label,
        title: titleOf(page.id),
        icon: item.icon,
        fragments: TUTORIAL_SCREENS[page.id],
      },
    ];
  });
}
