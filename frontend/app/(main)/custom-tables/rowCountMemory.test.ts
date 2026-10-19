import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SKELETON_ROWS,
  MAX_SKELETON_ROWS,
  readRowCount,
  rememberRowCount,
  skeletonRowCount,
} from './rowCountMemory';

describe('rowCountMemory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('draws as many skeleton rows as the table had last time', () => {
    rememberRowCount('t1', 6);
    expect(readRowCount('t1')).toBe(6);
    expect(skeletonRowCount('t1')).toBe(6);
  });

  it('falls back to the default for a table never seen', () => {
    expect(readRowCount('unknown')).toBeNull();
    expect(skeletonRowCount('unknown')).toBe(DEFAULT_SKELETON_ROWS);
  });

  it('caps a long table at what fits on screen', () => {
    rememberRowCount('big', 5000);
    expect(skeletonRowCount('big')).toBe(MAX_SKELETON_ROWS);
  });

  it('keeps an empty table at zero rows and ignores garbage', () => {
    rememberRowCount('empty', 0);
    expect(skeletonRowCount('empty')).toBe(0);
    localStorage.setItem('seneca:ct-row-count:bad', 'abc');
    expect(readRowCount('bad')).toBeNull();
  });
});
