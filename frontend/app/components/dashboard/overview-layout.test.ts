import { describe, expect, it } from 'vitest';
import {
  canSitBeside,
  DEFAULT_OVERVIEW_ROWS,
  isDefaultLayout,
  moveSection,
  normalizeRows,
  type OverviewRows,
} from './overview-layout';

const ROWS: OverviewRows = [['a'], ['b', 'c'], ['d']];

describe('moveSection', () => {
  it('puts a section on its own row above the target', () => {
    expect(moveSection(ROWS, 'd', 'a', 'above')).toEqual([['d'], ['a'], ['b', 'c']]);
  });

  it('puts a section on its own row below a pair, leaving its partner full width', () => {
    expect(moveSection(ROWS, 'b', 'd', 'below')).toEqual([['a'], ['c'], ['d'], ['b']]);
  });

  it('pairs a section with a lone one on the side it was dropped', () => {
    expect(moveSection(ROWS, 'd', 'a', 'left')).toEqual([['d', 'a'], ['b', 'c']]);
    expect(moveSection(ROWS, 'd', 'a', 'right')).toEqual([['a', 'd'], ['b', 'c']]);
  });

  it('swaps the two halves of a pair', () => {
    expect(moveSection(ROWS, 'c', 'b', 'left')).toEqual([['a'], ['c', 'b'], ['d']]);
  });

  it('leaves the layout alone when dropped on itself', () => {
    expect(moveSection(ROWS, 'b', 'b', 'above')).toBe(ROWS);
  });

  it('refuses a third section beside a pair', () => {
    expect(moveSection(ROWS, 'a', 'b', 'right')).toBe(ROWS);
  });
});

describe('canSitBeside', () => {
  it('allows a lone target or the partner of the same pair, not a full pair', () => {
    expect(canSitBeside(ROWS, 'd', 'a')).toBe(true);
    expect(canSitBeside(ROWS, 'c', 'b')).toBe(true);
    expect(canSitBeside(ROWS, 'a', 'b')).toBe(false);
  });
});

describe('normalizeRows', () => {
  it('falls back to the default when nothing was saved', () => {
    expect(normalizeRows(null)).toEqual(DEFAULT_OVERVIEW_ROWS);
    expect(normalizeRows({ rows: 'nonsense' })).toEqual(DEFAULT_OVERVIEW_ROWS);
  });

  it('drops sections that no longer exist and duplicates, and appends new ones', () => {
    const saved = [['net-worth', 'gone'], ['kpis', 'net-worth'], []];
    const rows = normalizeRows({ rows: saved });

    expect(rows.slice(0, 2)).toEqual([['net-worth'], ['kpis']]);
    expect(rows.flat().sort()).toEqual(DEFAULT_OVERVIEW_ROWS.flat().sort());
  });

  it('never keeps more than two sections in a row', () => {
    const rows = normalizeRows({ rows: [['kpis', 'crypto', 'goals']] });

    expect(rows[0]).toEqual(['kpis', 'crypto']);
    expect(rows.flat()).toContain('goals');
  });
});

describe('isDefaultLayout', () => {
  it('tells a rearranged layout from the shipped one', () => {
    expect(isDefaultLayout(DEFAULT_OVERVIEW_ROWS)).toBe(true);
    expect(isDefaultLayout(moveSection(DEFAULT_OVERVIEW_ROWS, 'kpis', 'activity', 'below'))).toBe(
      false,
    );
  });
});
