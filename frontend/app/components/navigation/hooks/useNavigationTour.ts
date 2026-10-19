'use client';

import { type DriveStep } from 'driver.js';
import { useCallback } from 'react';

type PopoverType = NonNullable<DriveStep['popover']>;

interface TourCandidate {
  selector: string;
  title: string;
  description: string;
  side?: PopoverType['side'];
  align?: PopoverType['align'];
}

interface TourStepTokens {
  brand: { title: unknown; description: unknown };
  navigation: { title: unknown; description: unknown };
  userMenu: { title: unknown; description: unknown };
  mobileMenu: { title: unknown; description: unknown };
}

interface UseNavigationTourParams {
  tour: { steps: TourStepTokens };
  isMobile: boolean;
  getText: (token: unknown) => string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function
export function useNavigationTour({ tour, isMobile, getText }: UseNavigationTourParams) {
  // eslint-disable-next-line max-lines-per-function
  const buildTourSteps = useCallback<() => DriveStep[]>(() => {
    if (typeof document === 'undefined') {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const isElementVisible = (element: Element) => {
      const rect = element.getClientRects();
      if (!rect.length) return false;
      const style = window.getComputedStyle(element as HTMLElement);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    const candidates: TourCandidate[] = [
      {
        selector: '[data-tour-id="brand"]',
        title: getText(tour.steps.brand.title),
        description: getText(tour.steps.brand.description),
        side: 'bottom',
        align: 'start',
      },
      {
        selector: '[data-tour-id="primary-nav"]',
        title: getText(tour.steps.navigation.title),
        description: getText(tour.steps.navigation.description),
        side: 'bottom',
        align: 'start',
      },
      {
        selector: '[data-tour-id="user-menu-trigger"]',
        title: getText(tour.steps.userMenu.title),
        description: getText(tour.steps.userMenu.description),
        side: 'bottom',
        align: 'end',
      },
    ];

    if (isMobile) {
      candidates.splice(1, 0, {
        selector: '[data-tour-id="mobile-menu-toggle"]',
        title: getText(tour.steps.mobileMenu.title),
        description: getText(tour.steps.mobileMenu.description),
        side: 'bottom',
        align: 'end',
      });
    }

    return candidates.flatMap<DriveStep>(candidate => {
      const element = document.querySelector(candidate.selector);
      if (!(element && isElementVisible(element))) {
        return [];
      }

      return [
        {
          element,
          popover: {
            title: candidate.title,
            description: candidate.description,
            side: candidate.side ?? 'bottom',
            align: candidate.align ?? 'start',
          },
        },
      ];
    });
  }, [getText, tour, isMobile]);

  return { buildTourSteps };
}
