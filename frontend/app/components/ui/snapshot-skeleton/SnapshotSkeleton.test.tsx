import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECAPTURE_DELAY_MS } from '@/app/hooks/useSkeletonSnapshot';
import { fallbackSnapshot } from '@/app/lib/snapshot-skeleton/fallback';
import { SnapshotSkeleton } from './SnapshotSkeleton';

// Measure right away instead of waiting for two frames and an idle period.
vi.mock('@/app/lib/snapshot-skeleton/after-paint', () => ({
  afterPaint: (callback: () => void) => {
    callback();
    return () => {};
  },
}));

const BLOCK_WIDTH = 1000;
const BLOCK_HEIGHT = 300;

/** Layout for jsdom: `data-box="x,y,w,h"` places an element, anything else fills the block. */
function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const [x, y, w, h] = (this.dataset.box ?? `0,0,${BLOCK_WIDTH},${BLOCK_HEIGHT}`)
      .split(',')
      .map(Number);
    return { x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h } as DOMRect;
  });
}

const boxes = () => screen.getByRole('status').querySelectorAll('.seneca-snapshot-skeleton__box');

beforeEach(() => {
  localStorage.clear();
  stubLayout();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('SnapshotSkeleton', () => {
  it('shows the generic sketch on a first visit, announced as loading', () => {
    render(<SnapshotSkeleton id="accounts" loading fallback="list" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
    expect(boxes()).toHaveLength(fallbackSnapshot('list').boxes.length);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('draws the layout remembered from the last render with data', () => {
    const { unmount } = render(
      <SnapshotSkeleton id="accounts" loading={false} fallback="list">
        <img alt="" data-box="0,0,200,100" />
      </SnapshotSkeleton>,
    );
    unmount();

    render(<SnapshotSkeleton id="accounts" loading fallback="list" />);

    expect(boxes()).toHaveLength(1);
    expect(boxes()[0]).toHaveStyle({ left: '0%', width: '20%', top: '0px', height: '100px' });
    expect(screen.getByRole('status')).toHaveStyle({ height: `${BLOCK_HEIGHT}px` });
  });

  it('swaps the sketch for the snapshot when loading starts again', () => {
    const { rerender } = render(
      <SnapshotSkeleton id="goals" loading={false}>
        <img alt="" data-box="500,20,100,50" />
      </SnapshotSkeleton>,
    );

    rerender(<SnapshotSkeleton id="goals" loading />);

    expect(boxes()).toHaveLength(1);
    expect(boxes()[0]).toHaveStyle({ left: '50%', width: '10%' });
  });

  it('does not remember an empty or error state', () => {
    const { unmount } = render(
      <SnapshotSkeleton id="accounts" loading={false} capture={false} fallback="list">
        <img alt="" data-box="0,0,200,100" />
      </SnapshotSkeleton>,
    );
    unmount();

    render(<SnapshotSkeleton id="accounts" loading fallback="list" />);

    expect(boxes()).toHaveLength(fallbackSnapshot('list').boxes.length);
  });

  it('measures again after the content changes', async () => {
    vi.useFakeTimers();
    const { rerender, unmount } = render(
      <SnapshotSkeleton id="feed" loading={false}>
        <img alt="" data-box="0,0,200,100" />
      </SnapshotSkeleton>,
    );
    rerender(
      <SnapshotSkeleton id="feed" loading={false}>
        <img alt="" data-box="0,0,200,100" />
        <img alt="" data-box="0,120,200,100" />
      </SnapshotSkeleton>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECAPTURE_DELAY_MS);
    });
    unmount();

    render(<SnapshotSkeleton id="feed" loading />);

    expect(boxes()).toHaveLength(2);
  });

  it('renders the generic sketch on the server, so hydration matches', () => {
    const { unmount } = render(
      <SnapshotSkeleton id="accounts" loading={false}>
        <img alt="" data-box="0,0,200,100" />
      </SnapshotSkeleton>,
    );
    unmount();

    const html = renderToString(<SnapshotSkeleton id="accounts" loading fallback="cards" />);

    expect(html.match(/seneca-snapshot-skeleton__box /g)).toHaveLength(
      fallbackSnapshot('cards').boxes.length,
    );
  });
});
