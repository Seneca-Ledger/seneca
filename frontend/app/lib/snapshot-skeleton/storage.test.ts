import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkeletonSnapshot } from './snapshot';
import { readSnapshot, writeSnapshot } from './storage';

const DESKTOP = 1200;
const PHONE = 375;
const snapshotOf = (height: number): SkeletonSnapshot => ({
  h: height,
  boxes: [{ k: 'text', x: 0, y: 0, w: 5000, h: 18, r: 0 }],
});
const ourKeys = () =>
  Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? '')
    .filter(key => key.startsWith('seneca:skeleton:v1:') && !key.endsWith(':index'))
    .sort();

describe('skeleton snapshot storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gives back what was written for the same id and width bucket', () => {
    writeSnapshot('dashboard', DESKTOP, snapshotOf(400));

    expect(readSnapshot('dashboard', DESKTOP + 50)).toEqual(snapshotOf(400));
    expect(localStorage.getItem('seneca:skeleton:v1:dashboard:lg')).not.toBeNull();
  });

  it('keeps phone and desktop layouts apart', () => {
    writeSnapshot('dashboard', DESKTOP, snapshotOf(400));

    expect(readSnapshot('dashboard', PHONE)).toBeNull();
  });

  it('returns nothing for a damaged entry', () => {
    localStorage.setItem('seneca:skeleton:v1:dashboard:lg', '{"h":"tall"}');

    expect(readSnapshot('dashboard', DESKTOP)).toBeNull();
  });

  it('drops the least recently used snapshots to stay within the budget', () => {
    let now = 1_000;
    const clock = () => now++;
    const budget = 3 * JSON.stringify({ h: 100, b: [[0, 0, 0, 5000, 18, 0]] }).length;

    writeSnapshot('first', DESKTOP, snapshotOf(100), { budget, now: clock });
    writeSnapshot('second', DESKTOP, snapshotOf(100), { budget, now: clock });
    writeSnapshot('third', DESKTOP, snapshotOf(100), { budget, now: clock });
    // Reading "first" makes "second" the oldest.
    readSnapshot('first', DESKTOP, { now: clock });
    writeSnapshot('fourth', DESKTOP, snapshotOf(100), { budget, now: clock });

    expect(ourKeys()).toEqual([
      'seneca:skeleton:v1:first:lg',
      'seneca:skeleton:v1:fourth:lg',
      'seneca:skeleton:v1:third:lg',
    ]);
  });

  it('survives a storage that throws', () => {
    // jsdom's Storage (Node 20) or the setup's MemoryStorage (Node 26).
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    const broken = vi.spyOn(proto, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const brokenSet = vi.spyOn(proto, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => writeSnapshot('dashboard', DESKTOP, snapshotOf(400))).not.toThrow();
    expect(readSnapshot('dashboard', DESKTOP)).toBeNull();

    broken.mockRestore();
    brokenSet.mockRestore();
  });
});
