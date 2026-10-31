'use client';

import clsx from 'clsx';
import type React from 'react';
import { useLayoutEffect, useRef } from 'react';

export interface FigureProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * A card's headline figure, sized by the card: an h3 at least, larger as the
 * card is moved into a wider slot, and smaller than h3 only when the figure
 * would not fit on one line otherwise. The stylesheet does the sizing; this
 * only tells it how many characters the figure has.
 */
export function Figure({ className, children }: FigureProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const chars = ref.current?.textContent?.length ?? 0;
    ref.current?.style.setProperty('--figure-chars', String(Math.max(chars, 1)));
  });
  return (
    <div className="seneca-figure">
      <div ref={ref} className={clsx('seneca-figure__value', className)}>
        {children}
      </div>
    </div>
  );
}
