'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { afterPaint } from '@/app/lib/snapshot-skeleton/after-paint';
import { measureSkeleton } from '@/app/lib/snapshot-skeleton/measure';
import type { SkeletonSnapshot } from '@/app/lib/snapshot-skeleton/snapshot';
import { readSnapshot, writeSnapshot } from '@/app/lib/snapshot-skeleton/storage';

/** Quiet time after the last DOM change before the block is measured again. */
export const RECAPTURE_DELAY_MS = 1500;

/**
 * Remembers the layout of a block between visits.
 *
 * While `loading`, it reads the snapshot saved for `id` at the skeleton's
 * width — after mount, so the server and the first paint both show the
 * generic skeleton and hydration matches. Once loaded (and `capture` allows
 * it), it measures the content after paint and again, debounced, whenever
 * the content changes.
 */
export function useSkeletonSnapshot(id: string, loading: boolean, capture: boolean) {
  const skeletonRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<SkeletonSnapshot | null>(null);

  useLayoutEffect(() => {
    if (!loading) {
      return;
    }
    const width = skeletonRef.current?.getBoundingClientRect().width ?? 0;
    setSnapshot(width > 0 ? readSnapshot(id, width) : null);
  }, [id, loading]);

  useEffect(() => {
    const content = contentRef.current;
    if (loading || !capture || !content) {
      return;
    }
    const save = () => {
      const measured = measureSkeleton(content);
      if (measured) {
        writeSnapshot(id, content.getBoundingClientRect().width, measured);
      }
    };
    let cancel = afterPaint(save);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => {
              cancel();
              cancel = afterPaint(save);
            }, RECAPTURE_DELAY_MS);
          });
    observer?.observe(content, { childList: true, subtree: true, characterData: true });
    return () => {
      cancel();
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [id, loading, capture]);

  return { skeletonRef, contentRef, snapshot };
}
