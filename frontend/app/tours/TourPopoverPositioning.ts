import type { Alignment, PopoverDOM, Side } from 'driver.js';

const POPOVER_MARGIN = 16;
const POSITION_RECHECK_DELAY_MS = 80;
const POPOVER_MAX_WIDTH = 400;
const POPOVER_MIN_WIDTH = 240;
const POPOVER_MOVE_TRANSITION =
  'left 220ms cubic-bezier(0.22, 1, 0.36, 1), top 220ms cubic-bezier(0.22, 1, 0.36, 1)';

let activeCleanup: (() => void) | null = null;

export interface TourBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TourPopoverPlacement {
  side?: Side;
  align?: Alignment;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

const viewportBounds = (): TourBounds => ({
  left: 0,
  top: 0,
  width: window.innerWidth,
  height: window.innerHeight,
});

const clipRectToViewport = (rect: DOMRect): TourBounds => {
  const viewport = viewportBounds();
  const left = clamp(rect.left, 0, viewport.width);
  const top = clamp(rect.top, 0, viewport.height);
  const right = clamp(rect.right, left, viewport.width);
  const bottom = clamp(rect.bottom, top, viewport.height);
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
};

function getUsableElementBounds(selector: string): TourBounds | null {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const bounds = clipRectToViewport(element.getBoundingClientRect());
  if (bounds.width < 280 || bounds.height < 180) {
    return null;
  }
  return bounds;
}

function resolveTourBounds(activeElement: Element | null): TourBounds {
  if (activeElement?.closest('.seneca-shell__sidebar')) {
    return viewportBounds();
  }

  return (
    getUsableElementBounds('.seneca-shell__content') ??
    getUsableElementBounds('main') ??
    viewportBounds()
  );
}

function applyPopoverSize(wrapper: HTMLElement, bounds: TourBounds): void {
  const availableWidth = Math.max(1, bounds.width - POPOVER_MARGIN * 2);
  const width = Math.min(POPOVER_MAX_WIDTH, Math.max(POPOVER_MIN_WIDTH, availableWidth));
  const maxHeight = Math.max(1, bounds.height - POPOVER_MARGIN * 2);

  wrapper.style.position = 'fixed';
  wrapper.style.width = `${Math.min(width, availableWidth)}px`;
  wrapper.style.minWidth = '0';
  wrapper.style.maxWidth = `${availableWidth}px`;
  wrapper.style.maxHeight = `${maxHeight}px`;
  wrapper.style.overflowY = 'auto';
}

function forcePopoverInteractivity(popover: PopoverDOM): void {
  [
    popover.wrapper,
    popover.footer,
    popover.footerButtons,
    popover.previousButton,
    popover.nextButton,
    popover.closeButton,
  ].forEach(element => {
    element.style.pointerEvents = 'auto';
    element.style.zIndex = '2147483647';
  });

  [popover.footer, popover.footerButtons, popover.previousButton, popover.nextButton].forEach(
    element => {
      element.style.position ||= 'relative';
    },
  );

  popover.closeButton.style.position = 'absolute';
  popover.closeButton.style.top = '0';
  popover.closeButton.style.left = '0';
  popover.closeButton.style.right = 'auto';
  popover.closeButton.style.width = '44px';
  popover.closeButton.style.height = '44px';

  popover.wrapper.style.isolation = 'isolate';
  popover.wrapper.style.zIndex = '2147483647';
}

function alignInline(targetRect: DOMRect, popoverRect: DOMRect, align: Alignment): number {
  if (align === 'center') {
    return targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
  }
  if (align === 'end') {
    return targetRect.right - popoverRect.width;
  }
  return targetRect.left;
}

function alignBlock(targetRect: DOMRect, popoverRect: DOMRect, align: Alignment): number {
  if (align === 'center') {
    return targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
  }
  if (align === 'end') {
    return targetRect.bottom - popoverRect.height;
  }
  return targetRect.top;
}

function setPopoverPosition(wrapper: HTMLElement, left: number, top: number): void {
  const roundedLeft = Math.round(left);
  const roundedTop = Math.round(top);

  // The rAF follow loop in stabilizeTourPopover calls this every frame even when
  // nothing moved. Comparing against the previously *specified* style (not the
  // rendered rect, which is mid-transition) avoids re-triggering the left/top
  // transition on every frame, which otherwise reads as constant jitter.
  if (
    Number.parseFloat(wrapper.style.left) === roundedLeft &&
    Number.parseFloat(wrapper.style.top) === roundedTop
  ) {
    return;
  }

  wrapper.style.left = `${roundedLeft}px`;
  wrapper.style.top = `${roundedTop}px`;
  wrapper.style.right = 'auto';
  wrapper.style.bottom = 'auto';
  wrapper.style.transform = 'none';
}

function centerPopoverInBounds(
  wrapper: HTMLElement,
  popoverRect: DOMRect,
  bounds: TourBounds,
): void {
  setPopoverPosition(
    wrapper,
    bounds.left + (bounds.width - popoverRect.width) / 2,
    bounds.top + (bounds.height - popoverRect.height) / 2,
  );
}

export function positionTourPopoverNearElement(
  wrapper: HTMLElement,
  target: Element | null,
  bounds: TourBounds,
  placement: TourPopoverPlacement = {},
): void {
  const popoverRect = wrapper.getBoundingClientRect();
  const targetRect = target?.getBoundingClientRect();

  if (!targetRect || target === document.body || targetRect.width <= 0 || targetRect.height <= 0) {
    centerPopoverInBounds(wrapper, popoverRect, bounds);
    clampTourPopoverToBounds(wrapper, bounds);
    return;
  }

  const gap = 12;
  const side = placement.side ?? 'bottom';
  const align = placement.align ?? 'start';
  // driver.js's `Side` is top/right/bottom/left, and TourStep narrows it to the
  // same four, so there was no way to reach the 'over' branches these used to
  // carry — TypeScript flagged both as impossible comparisons.
  const left =
    side === 'right'
      ? targetRect.right + gap
      : side === 'left'
        ? targetRect.left - popoverRect.width - gap
        : alignInline(targetRect, popoverRect, align);
  const top =
    side === 'bottom'
      ? targetRect.bottom + gap
      : side === 'top'
        ? targetRect.top - popoverRect.height - gap
        : alignBlock(targetRect, popoverRect, align);

  setPopoverPosition(wrapper, left, top);
  clampTourPopoverToBounds(wrapper, bounds);
}

export function clampTourPopoverToBounds(
  wrapper: HTMLElement,
  bounds: TourBounds,
  margin = POPOVER_MARGIN,
): void {
  const rect = wrapper.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return;
  }

  const left = clamp(
    rect.left,
    bounds.left + margin,
    bounds.left + bounds.width - rect.width - margin,
  );
  const top = clamp(
    rect.top,
    bounds.top + margin,
    bounds.top + bounds.height - rect.height - margin,
  );

  if (Math.abs(left - rect.left) < 1 && Math.abs(top - rect.top) < 1) {
    return;
  }

  wrapper.style.left = `${Math.round(left)}px`;
  wrapper.style.top = `${Math.round(top)}px`;
  wrapper.style.right = 'auto';
  wrapper.style.bottom = 'auto';
  wrapper.style.transform = 'none';
}

export function clampTourPopoverToViewport(wrapper: HTMLElement, margin = POPOVER_MARGIN): void {
  clampTourPopoverToBounds(wrapper, viewportBounds(), margin);
}

export function cleanupStableTourPopoverPositioning(): void {
  activeCleanup?.();
  activeCleanup = null;
}

export function stabilizeTourPopover(popover: PopoverDOM, placement?: TourPopoverPlacement): void {
  cleanupStableTourPopoverPositioning();

  const { wrapper } = popover;
  forcePopoverInteractivity(popover);
  wrapper.style.pointerEvents = 'auto';
  wrapper.style.transition = POPOVER_MOVE_TRANSITION;
  wrapper.style.willChange = 'left, top';

  let followFrame = 0;
  let scheduledFrame = 0;
  let recheckTimeout = 0;
  const reposition = (): void => {
    const activeElement = document.querySelector('.driver-active-element');
    const bounds = resolveTourBounds(activeElement);
    applyPopoverSize(wrapper, bounds);
    positionTourPopoverNearElement(wrapper, activeElement, bounds, placement);
  };
  const followActiveElement = (): void => {
    reposition();
    followFrame = window.requestAnimationFrame(followActiveElement);
  };
  const scheduleReposition = (): void => {
    if (scheduledFrame) {
      window.cancelAnimationFrame(scheduledFrame);
    }
    scheduledFrame = window.requestAnimationFrame(() => {
      scheduledFrame = 0;
      reposition();
    });
  };

  reposition();
  followFrame = window.requestAnimationFrame(followActiveElement);
  recheckTimeout = window.setTimeout(reposition, POSITION_RECHECK_DELAY_MS);

  const controller = new AbortController();
  window.addEventListener('resize', scheduleReposition, {
    passive: true,
    signal: controller.signal,
  });
  window.addEventListener('scroll', scheduleReposition, {
    capture: true,
    passive: true,
    signal: controller.signal,
  });

  activeCleanup = (): void => {
    if (followFrame) {
      window.cancelAnimationFrame(followFrame);
    }
    if (scheduledFrame) {
      window.cancelAnimationFrame(scheduledFrame);
    }
    if (recheckTimeout) {
      window.clearTimeout(recheckTimeout);
    }
    controller.abort();
  };
}
