'use client';

import { useEffect, useState } from 'react';
import type { PageHintStep } from './page-hints';
import { findVisibleAnchor, isPageCovered } from './page-hints-dom';

const POLL_MS = 250;
/** How long the page may take to render the elements the hints point at. */
export const ANCHOR_WAIT_MS = 8000;

export interface HintAnchors {
  /** `waiting` for the page to render, `ready` to show, `gone` when nothing turned up. */
  phase: 'waiting' | 'ready' | 'gone';
  /** The steps whose element is on the page, with that element. */
  steps: Array<{ step: PageHintStep; element: HTMLElement }>;
  /** A dialog, drawer or menu is open over the page. */
  covered: boolean;
}

const anchorOf = (step: PageHintStep): HTMLElement | null =>
  findVisibleAnchor(step.anchor) ?? (step.fallback ? findVisibleAnchor(step.fallback) : null);

function locate(steps: readonly PageHintStep[]): HintAnchors['steps'] {
  return steps.flatMap(step => {
    const element = anchorOf(step);
    return element ? [{ step, element }] : [];
  });
}

const sameSteps = (a: HintAnchors['steps'], b: HintAnchors['steps']): boolean =>
  a.length === b.length && a.every((entry, index) => entry.element === b[index]?.element);

/** Shown: follows a dialog opening over the page, and the page re-rendering an element. */
function follow(previous: HintAnchors, covered: boolean): HintAnchors {
  const found = covered ? previous.steps : locate(previous.steps.map(entry => entry.step));
  return previous.covered === covered && sameSteps(previous.steps, found)
    ? previous
    : { ...previous, steps: found, covered };
}

/**
 * Watches the page for the elements the hints point at. It waits until all of
 * them are there or ANCHOR_WAIT_MS have passed, then keeps the ones it found.
 * Time under a dialog does not count: the page behind it is hidden from the
 * check, and the hints wait for the dialog to close anyway.
 */
export function useHintAnchors(steps: readonly PageHintStep[]): HintAnchors {
  const [state, setState] = useState<HintAnchors>({ phase: 'waiting', steps: [], covered: false });

  useEffect(() => {
    let waited = 0;
    let phase: HintAnchors['phase'] = 'waiting';

    const waitForAnchors = (): void => {
      const found = locate(steps);
      waited += POLL_MS;
      if (found.length < steps.length && waited < ANCHOR_WAIT_MS) {
        return;
      }
      phase = found.length > 0 ? 'ready' : 'gone';
      setState({ phase, steps: found, covered: false });
      if (phase === 'gone') {
        window.clearInterval(timer);
      }
    };

    const check = (): void => {
      const covered = isPageCovered();
      if (phase !== 'waiting') {
        setState(previous => follow(previous, covered));
      } else if (!covered) {
        waitForAnchors();
      }
    };

    const timer = window.setInterval(check, POLL_MS);
    check();
    return () => window.clearInterval(timer);
  }, [steps]);

  return state;
}
