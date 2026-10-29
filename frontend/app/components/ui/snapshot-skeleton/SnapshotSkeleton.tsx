'use client';

import type React from 'react';
import type { ReactNode } from 'react';
import { useSkeletonSnapshot } from '@/app/hooks/useSkeletonSnapshot';
import { useIntlayer } from '@/app/i18n';
import { fallbackSnapshot, type SkeletonFallback } from '@/app/lib/snapshot-skeleton/fallback';
import { SkeletonBoxes } from './SkeletonBoxes';

export interface SnapshotSkeletonProps {
  /** Names the block; its layout is remembered under this id. */
  id: string;
  loading: boolean;
  /** The sketch for a first visit, before any layout was remembered. */
  fallback?: SkeletonFallback;
  /** False while an empty or error state shows, so it is not remembered as the layout. */
  capture?: boolean;
  /** Applied to both the skeleton and the content wrapper, so they sit alike. */
  className?: string;
  children?: ReactNode;
}

/**
 * Shows a skeleton of what this block looked like last time while it loads,
 * and a generic one on a first visit. Replaces page- and block-level spinners.
 */
export function SnapshotSkeleton({
  id,
  loading,
  fallback = 'page',
  capture = true,
  className,
  children,
}: SnapshotSkeletonProps): React.JSX.Element {
  const t = useIntlayer('uiShell');
  const { skeletonRef, contentRef, snapshot } = useSkeletonSnapshot(id, loading, capture);

  if (loading) {
    // Before the remembered layout is read (the server, hydration), an empty
    // block of the sketch's height: a sketch of some other layout would show
    // for a moment and then jump to the real one.
    const sketch = fallbackSnapshot(fallback);
    return (
      <SkeletonBoxes
        ref={skeletonRef}
        snapshot={snapshot === undefined ? { h: sketch.h, boxes: [] } : (snapshot ?? sketch)}
        label={t.loading.value}
        className={className}
      />
    );
  }
  return (
    <div ref={contentRef} className={className}>
      {children}
    </div>
  );
}
