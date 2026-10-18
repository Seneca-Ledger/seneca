'use client';

import type React from 'react';
import { useState } from 'react';
import { nextStep, pageTurnOf, previousStep } from './tutorial-pager';

export interface TutorialPager {
  index: number;
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export function useTutorialPager(stepCount: number): TutorialPager {
  const [index, setIndex] = useState(0);
  const next = (): void => setIndex(current => nextStep(current, stepCount));
  const back = (): void => setIndex(previousStep);
  const onKeyDown = (event: React.KeyboardEvent): void => {
    const turn = pageTurnOf(event.key, document.documentElement.dir === 'rtl');
    if (turn) {
      event.preventDefault();
      (turn === 'next' ? next : back)();
    }
  };
  return { index, next, back, goTo: setIndex, onKeyDown };
}
