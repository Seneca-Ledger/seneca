'use client';

import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { visuallyHidden } from '@mui/utils';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { User } from '@/app/contexts/AuthContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { PageHintCard } from './PageHintCard';
import {
  type PageHintStep,
  type PageHintsPageId,
  pageHintsVersion,
  resolveHintPage,
  unseenSteps,
} from './page-hints';
import { useHintAnchors } from './useHintAnchors';
import { useMarkPageHintsSeen } from './useMarkPageHintsSeen';

/** Below this width only the first step shows, as a card at the bottom. */
const SMALL_SCREEN = '(max-width: 599.95px)';

/**
 * Hints come after the welcome window, and only when the server's record of
 * them is known: a user object without `pageHintsSeen` (an older cached copy)
 * must never read as "nothing seen yet".
 */
export function canShowPageHints(user: User | null): user is User & {
  pageHintsSeen: Record<string, number>;
} {
  return (
    Boolean(user?.onboardingCompletedAt) &&
    typeof user?.welcomeTutorialSeenAt === 'string' &&
    user?.pageHintsSeen !== undefined
  );
}

function useHintTexts(page: PageHintsPageId) {
  const content = useIntlayer('pageHints');
  const texts = content.pages[page] as Record<
    string,
    { title: { value: string }; body: { value: string } }
  >;
  return { controls: content.controls, texts };
}

interface SessionProps {
  page: PageHintsPageId;
  steps: PageHintStep[];
}

/** One page visit: finds the elements, shows the steps, records the close. */
function PageHintsSession({ page, steps: unseen }: SessionProps): React.JSX.Element {
  // The steps of this visit stay as they were when it began, whatever the user
  // object does meanwhile.
  const [steps] = useState(unseen);
  const anchors = useHintAnchors(steps);
  const small = useMediaQuery(SMALL_SCREEN);
  const markSeen = useMarkPageHintsSeen();
  const { controls, texts } = useHintTexts(page);
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState(false);

  const shown = small ? anchors.steps.slice(0, 1) : anchors.steps;
  const current = shown[Math.min(index, shown.length - 1)];
  const visible = anchors.phase === 'ready' && !anchors.covered && !closed && current !== undefined;

  const close = (): void => {
    setClosed(true);
    markSeen(page, pageHintsVersion(page));
  };

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  const text = current ? texts[current.step.id] : undefined;
  const position = Math.min(index, shown.length - 1) + 1;
  return (
    <>
      {/* Focus stays on the page; screen readers hear the hint instead. */}
      <Box aria-live="polite" sx={visuallyHidden}>
        {visible && text ? `${text.title.value}. ${text.body.value}` : ''}
      </Box>
      {visible && text ? (
        <PageHintCard
          anchorEl={current.element}
          placement={current.step.placement}
          title={text.title.value}
          body={text.body.value}
          index={position - 1}
          total={shown.length}
          small={small}
          labels={{
            next: controls.next.value,
            done: controls.done.value,
            close: controls.close.value,
            stepOf: controls.stepOf.value
              .replace('{{current}}', String(position))
              .replace('{{total}}', String(shown.length)),
          }}
          onNext={() => setIndex(position)}
          onClose={close}
        />
      ) : null}
    </>
  );
}

/**
 * Mounted once in the root layout. On the first visit to a page it points at
 * one to three things on it, once; the server remembers which hint version each
 * page was closed at. Navigating away hides them without recording anything.
 */
export function PageHintsHost(): React.JSX.Element | null {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const page = pathname ? resolveHintPage(pathname) : null;

  if (loading || !page || !canShowPageHints(user)) {
    return null;
  }
  const steps = unseenSteps(page, user.pageHintsSeen);
  if (steps.length === 0) {
    return null;
  }
  return <PageHintsSession key={pathname} page={page} steps={steps} />;
}
