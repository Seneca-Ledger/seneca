import type React from 'react';
import type { CSSProperties, Ref } from 'react';
import type { SkeletonBox, SkeletonSnapshot } from '@/app/lib/snapshot-skeleton/snapshot';
import { WIDTH_SCALE } from '@/app/lib/snapshot-skeleton/snapshot';

/** A text bar is thinner than its line box, like the glyphs inside it. */
const TEXT_BAR_SHARE = 0.62;
const MIN_TEXT_BAR = 6;

const percent = (share: number): string => `${(share / WIDTH_SCALE) * 100}%`;

function boxStyle(box: SkeletonBox): CSSProperties {
  if (box.k === 'text') {
    const bar = Math.max(MIN_TEXT_BAR, Math.round(box.h * TEXT_BAR_SHARE));
    return {
      left: percent(box.x),
      width: percent(box.w),
      top: box.y + Math.round((box.h - Math.min(bar, box.h)) / 2),
      height: Math.min(bar, box.h),
    };
  }
  // A circle keeps its shape at any width: its height sets its width.
  const width = box.k === 'circle' ? box.h : percent(box.w);
  return { left: percent(box.x), width, top: box.y, height: box.h, borderRadius: box.r };
}

interface SkeletonBoxesProps {
  snapshot: SkeletonSnapshot;
  label: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Draws a snapshot as placeholder shapes, scaled to the current width. */
export function SkeletonBoxes({
  snapshot,
  label,
  className,
  ref,
}: SkeletonBoxesProps): React.JSX.Element {
  return (
    <div
      ref={ref}
      role="status"
      aria-label={label}
      aria-busy="true"
      className={['seneca-snapshot-skeleton', className].filter(Boolean).join(' ')}
      style={{ height: snapshot.h }}
    >
      {snapshot.boxes.map((box, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: boxes have no identity; the list is redrawn as a whole
          key={index}
          aria-hidden="true"
          className={`seneca-snapshot-skeleton__box seneca-snapshot-skeleton__box--${box.k}`}
          style={boxStyle(box)}
        />
      ))}
    </div>
  );
}
