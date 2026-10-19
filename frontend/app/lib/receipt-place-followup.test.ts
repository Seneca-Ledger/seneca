// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueuePlaceFollowups,
  FOLLOWUP_TTL_MS,
  getReceiptPlacePrompt,
  listPlaceFollowups,
  needsPlaceFollowup,
  RECEIPT_PLACE_FOLLOWUP_EVENT,
  removePlaceFollowup,
  setReceiptPlacePrompt,
} from './receipt-place-followup';

const entry = (statementId: string, capturedAt: number, workspaceId = 'ws-1') => ({
  statementId,
  workspaceId,
  capturedAt,
});

describe('receipt place follow-up queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks by default and remembers "don’t show again"', () => {
    expect(getReceiptPlacePrompt()).toBe(true);

    setReceiptPlacePrompt(false);
    expect(getReceiptPlacePrompt()).toBe(false);

    setReceiptPlacePrompt(true);
    expect(getReceiptPlacePrompt()).toBe(true);
  });

  it('lists the newest first and stores no coordinates', () => {
    const now = Date.now();
    enqueuePlaceFollowups([entry('a', now - 3000)]);
    enqueuePlaceFollowups([entry('b', now - 1000), entry('c', now - 2000)]);

    expect(listPlaceFollowups().map(item => item.statementId)).toEqual(['b', 'c', 'a']);
    expect(localStorage.getItem('seneca-receipt-place-pending')).not.toMatch(/lat|lng|longitude/);
  });

  it('forgets entries older than two hours', () => {
    const now = Date.now();
    enqueuePlaceFollowups([entry('old', now - FOLLOWUP_TTL_MS - 1), entry('fresh', now - 1000)]);

    expect(listPlaceFollowups(now).map(item => item.statementId)).toEqual(['fresh']);
  });

  it('keeps at most ten entries and replaces a statement queued twice', () => {
    const now = Date.now();
    enqueuePlaceFollowups(Array.from({ length: 12 }, (_, i) => entry(`s${i}`, now - i * 1000)));
    enqueuePlaceFollowups([entry('s5', now + 0)]);

    const ids = listPlaceFollowups(now).map(item => item.statementId);
    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe('s5');
    expect(ids.filter(id => id === 's5')).toHaveLength(1);
  });

  it('removes one entry and notifies listeners', () => {
    const listener = vi.fn();
    window.addEventListener(RECEIPT_PLACE_FOLLOWUP_EVENT, listener);
    const now = Date.now();
    enqueuePlaceFollowups([entry('a', now), entry('b', now - 1)]);

    removePlaceFollowup('a');

    expect(listPlaceFollowups().map(item => item.statementId)).toEqual(['b']);
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(RECEIPT_PLACE_FOLLOWUP_EVENT, listener);
  });

  it('queues nothing once turned off, and turning off clears the queue', () => {
    enqueuePlaceFollowups([entry('a', Date.now())]);

    setReceiptPlacePrompt(false);
    enqueuePlaceFollowups([entry('b', Date.now())]);

    expect(listPlaceFollowups()).toEqual([]);
  });

  it('ignores malformed storage and storage that throws', () => {
    localStorage.setItem('seneca-receipt-place-pending', '[{"statementId":1},"x",null]');
    expect(listPlaceFollowups()).toEqual([]);

    localStorage.setItem('seneca-receipt-place-pending', '{not json');
    expect(listPlaceFollowups()).toEqual([]);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(listPlaceFollowups()).toEqual([]);
    expect(() => enqueuePlaceFollowups([entry('a', Date.now())])).not.toThrow();
    expect(getReceiptPlacePrompt()).toBe(true);
  });

  it('asks only when the camera got no fix or a rough one', () => {
    expect(needsPlaceFollowup(null)).toBe(true);
    expect(needsPlaceFollowup({ accuracy: 250 })).toBe(true);
    expect(needsPlaceFollowup({ accuracy: Number.NaN })).toBe(true);
    expect(needsPlaceFollowup({ accuracy: 100 })).toBe(false);
    expect(needsPlaceFollowup({ accuracy: 12 })).toBe(false);
  });
});
