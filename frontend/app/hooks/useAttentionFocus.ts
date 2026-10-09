'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** How long the ring stays before it fades out. */
const HIGHLIGHT_MS = 3000;
/**
 * Give up waiting for the target rather than observing the DOM forever. Long
 * enough for the slowest destination: the Cash flow tab draws its rows only
 * once it has paged through every statement and transaction, which on a real
 * workspace lands well past five seconds. Waiting costs one idle
 * MutationObserver, so erring long is cheaper than a link that does nothing.
 */
const WAIT_MS = 20000;

const ATTENTION_CLASS = 'lumio-attention';
const FOCUS_PARAM = 'focus';

/**
 * Some lists render a desktop table and mobile cards side by side and hide one
 * with CSS, so the first match can be invisible. Prefer a rendered one; fall
 * back to the first match (which is also what jsdom, with no layout, gets).
 */
function findTarget(selector: string): Element | null {
  const matches = Array.from(document.querySelectorAll(selector));
  return matches.find(element => element.getClientRects().length > 0) ?? matches[0] ?? null;
}

/**
 * Runs `onFound` with the first element matching `selector`, now or as soon as
 * it renders — the target of a deep link usually appears only once its data has
 * loaded. Returns a cleanup that stops waiting.
 */
function whenPresent(selector: string, onFound: (element: Element) => void): () => void {
  const noop = (): void => undefined;
  const existing = findTarget(selector);
  if (existing) {
    onFound(existing);
    return noop;
  }

  const observer = new MutationObserver(() => {
    const element = findTarget(selector);
    if (element) {
      observer.disconnect();
      window.clearTimeout(timer);
      onFound(element);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = window.setTimeout(() => observer.disconnect(), WAIT_MS);

  return () => {
    observer.disconnect();
    window.clearTimeout(timer);
  };
}

/** How long to keep the target centred while the page is still growing. */
const FOLLOW_MS = 6000;
/** Re-centring any closer than this is the scroll still settling, not a miss. */
const CENTRED_SLACK_PX = 8;

/**
 * Keeps the scroll on `element` while the page is still growing. A destination
 * that stacks several sections (Reports → Cash flow) draws them one after the
 * other, and every one that appears above the target pushes it down again, so
 * the single scroll that follows the ring lands nowhere. Polling beats
 * observing the body: the sections grow inside it without changing its box.
 * The first deliberate scroll, wheel or key hands control back to the reader.
 */
function keepCentred(element: Element): () => void {
  let stopped = false;
  const stop = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    window.clearInterval(timer);
    window.clearTimeout(expiry);
    window.removeEventListener('wheel', stop);
    window.removeEventListener('touchmove', stop);
    window.removeEventListener('keydown', stop);
  };
  const timer = window.setInterval(() => {
    const box = element.getBoundingClientRect();
    const offCentre = Math.abs(box.top + box.height / 2 - window.innerHeight / 2);
    if (offCentre > CENTRED_SLACK_PX) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, 250);
  const expiry = window.setTimeout(stop, FOLLOW_MS);
  window.addEventListener('wheel', stop, { passive: true });
  window.addEventListener('touchmove', stop, { passive: true });
  window.addEventListener('keydown', stop);
  return stop;
}

/**
 * Scrolls to the element a deep link points at and rings it in green, and
 * returns the target's id so a list can make sure it is drawn at all.
 *
 * The link carries `?focus=<id>` and the target marks itself with
 * `data-attention="<id>"`, so pages opt in by tagging one element instead of
 * each one growing its own deep-link plumbing. Producers are insight links
 * (app/components/insights/insight-href.ts) and the notification bell
 * (app/components/notifications/notification-href.ts).
 *
 * The returned id outlives the parameter, which is cleared below as soon as
 * the page arrives: a leaderboard mounts only once its data has loaded, long
 * after that, and it needs the id to keep the row the link is about.
 *
 * Call it from the destination page, not from the layout: a layout is not
 * remounted on soft navigation, so arriving at the page you are already on
 * with a different target would do nothing.
 */
export function useAttentionFocus(): string | null {
  const targetId = useSearchParams()?.get(FOCUS_PARAM) ?? null;
  const [lastTargetId, setLastTargetId] = useState<string | null>(targetId);
  const cleanupRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (targetId !== null) {
      setLastTargetId(targetId);
    }
  }, [targetId]);

  // Tearing down belongs to the page's lifetime, not to the parameter's: the
  // effect below deliberately returns nothing, so React cannot undo a
  // highlight the moment the parameter is cleared.
  useEffect(() => () => cleanupRef.current(), []);

  useEffect(() => {
    if (!targetId) {
      return;
    }
    cleanupRef.current();

    // Cleared through history rather than `router.replace` — the page content
    // is already here and a navigation would only round-trip. Cleared even
    // when nothing matches, so a target that never appears (an insight written
    // without an id, a workspace with no data) cannot re-trigger later.
    //
    // Note this still moves `useSearchParams` to null, which is why the
    // highlight's lifetime is held in a ref instead of this effect's cleanup.
    const url = new URL(window.location.href);
    url.searchParams.delete(FOCUS_PARAM);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);

    let highlighted: Element | null = null;
    let fadeTimer: number | undefined;

    let stopFollowing = (): void => undefined;

    // First match in document order. One category can produce several
    // leaderboard rows (per source and currency); sorted by amount, the first
    // is the largest, which is the one the insight was about.
    const stopWaiting = whenPresent(`[data-attention="${CSS.escape(targetId)}"]`, element => {
      highlighted = element;
      // Ring first, scroll second: starting the smooth scroll in the same tick
      // before the class lands leaves the outline transition stuck at its
      // transparent start value, so the ring never appears.
      element.classList.add(ATTENTION_CLASS);
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      stopFollowing = keepCentred(element);
      fadeTimer = window.setTimeout(() => element.classList.remove(ATTENTION_CLASS), HIGHLIGHT_MS);
    });

    cleanupRef.current = () => {
      stopWaiting();
      stopFollowing();
      window.clearTimeout(fadeTimer);
      highlighted?.classList.remove(ATTENTION_CLASS);
    };
  }, [targetId]);

  return lastTargetId;
}
