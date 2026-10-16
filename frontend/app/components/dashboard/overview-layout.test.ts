import { describe, expect, it } from 'vitest';
import {
  canSitBeside,
  DEFAULT_OVERVIEW_ROWS,
  hideSection,
  isDefaultLayout,
  moveSection,
  normalizeRows,
  type OverviewRows,
  rowSpans,
  showSection,
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

  it('puts a tile right next to the one it was dropped beside', () => {
    const tiles: OverviewRows = [['kpi-income', 'kpi-spent', 'kpi-net'], ['kpi-savings']];
    expect(moveSection(tiles, 'kpi-savings', 'kpi-income', 'right')).toEqual([
      ['kpi-income', 'kpi-savings', 'kpi-spent', 'kpi-net'],
    ]);
  });

  it('lets a tile join a card, and two tiles, but not a third', () => {
    const rows: OverviewRows = [['goals'], ['kpi-income'], ['kpi-spent'], ['kpi-net']];
    const one = moveSection(rows, 'kpi-income', 'goals', 'right');
    const two = moveSection(one, 'kpi-spent', 'kpi-income', 'right');
    expect(two).toEqual([['goals', 'kpi-income', 'kpi-spent'], ['kpi-net']]);
    expect(moveSection(two, 'kpi-net', 'kpi-spent', 'right')).toBe(two);
  });

  it('gives a tile a row of its own when dropped above or below', () => {
    const rows: OverviewRows = [[...['kpi-income', 'kpi-spent']], ['goals']];
    expect(moveSection(rows, 'kpi-spent', 'goals', 'below')).toEqual([
      ['kpi-income'],
      ['goals'],
      ['kpi-spent'],
    ]);
  });
});

describe('rowSpans', () => {
  it('gives a lone card the row and two cards half each', () => {
    expect(Object.fromEntries(rowSpans(['goals']))).toEqual({ goals: 12 });
    expect(Object.fromEntries(rowSpans(['goals', 'budgets']))).toEqual({ goals: 6, budgets: 6 });
  });

  it('shares the row among tiles, and what a card leaves among tiles beside it', () => {
    expect(
      Object.fromEntries(rowSpans(['kpi-income', 'kpi-spent', 'kpi-net', 'kpi-savings'])),
    ).toEqual({ 'kpi-income': 3, 'kpi-spent': 3, 'kpi-net': 3, 'kpi-savings': 3 });
    expect(Object.fromEntries(rowSpans(['kpi-income', 'kpi-spent', 'kpi-net']))).toEqual({
      'kpi-income': 4,
      'kpi-spent': 4,
      'kpi-net': 4,
    });
    expect(Object.fromEntries(rowSpans(['goals', 'kpi-income', 'kpi-spent']))).toEqual({
      goals: 6,
      'kpi-income': 3,
      'kpi-spent': 3,
    });
    expect(Object.fromEntries(rowSpans(['kpi-net']))).toEqual({ 'kpi-net': 12 });
  });
});

describe('canSitBeside', () => {
  it('allows a lone target or the partner of the same pair, not a full pair', () => {
    expect(canSitBeside(ROWS, 'd', 'a')).toBe(true);
    expect(canSitBeside(ROWS, 'c', 'b')).toBe(true);
    expect(canSitBeside(ROWS, 'a', 'b')).toBe(false);
  });

  it('counts tiles as a quarter of the row and cards as half', () => {
    const rows: OverviewRows = [['kpi-income', 'kpi-spent', 'kpi-net'], ['goals'], ['kpi-savings']];
    expect(canSitBeside(rows, 'kpi-savings', 'kpi-income')).toBe(true);
    expect(canSitBeside(rows, 'goals', 'kpi-income')).toBe(false);
  });
});

describe('normalizeRows', () => {
  it('falls back to the default when nothing was saved', () => {
    expect(normalizeRows(null)).toEqual(DEFAULT_OVERVIEW_ROWS);
    expect(normalizeRows({ rows: 'nonsense' })).toEqual(DEFAULT_OVERVIEW_ROWS);
  });

  it('drops sections that no longer exist and duplicates, and appends new ones', () => {
    const saved = [['net-worth', 'gone'], ['crypto', 'net-worth'], []];
    const rows = normalizeRows({ rows: saved });

    expect(rows.slice(0, 3)).toEqual([['getting-started'], ['net-worth'], ['crypto']]);
    expect(rows.flat().sort()).toEqual([...DEFAULT_OVERVIEW_ROWS.flat(), 'crypto'].sort());
  });

  it('opens an older saved layout with the setup checklist, and leaves a placed one alone', () => {
    expect(normalizeRows({ rows: [['activity'], ['crypto']] }).slice(0, 2)).toEqual([
      ['getting-started'],
      ['activity'],
    ]);
    expect(
      normalizeRows({ rows: [['crypto'], ['getting-started']] }).slice(0, 2),
    ).toEqual([['crypto'], ['getting-started']]);
  });

  it('never keeps more in a row than fits', () => {
    const rows = normalizeRows({ rows: [['goals', 'crypto', 'net-worth']] });

    expect(rows[1]).toEqual(['goals', 'crypto']);
    expect(rows.flat()).toContain('net-worth');
  });

  it('turns the old single KPI row into the four tiles in its place', () => {
    const rows = normalizeRows({ rows: [['getting-started'], ['goals'], ['kpis', 'crypto']] });

    expect(rows.slice(0, 4)).toEqual([
      ['getting-started'],
      ['goals'],
      ['kpi-income', 'kpi-spent', 'kpi-net', 'kpi-savings'],
      ['crypto'],
    ]);
    expect(rows.flat().sort()).toEqual([...DEFAULT_OVERVIEW_ROWS.flat(), 'crypto'].sort());
  });
});

describe('hidden and optional sections', () => {
  it('keeps the widgets that are off by default out until they are switched on', () => {
    const rows = normalizeRows({ rows: [['goals']] }).flat();

    expect(rows).not.toContain('taxes');
    expect(rows).not.toContain('advice');
    expect(rows).not.toContain('crypto');
    expect(rows).toContain('safe-to-spend');
    expect(normalizeRows({ rows: [['goals'], ['taxes']] }).flat()).toContain('taxes');
  });

  it('does not bring back a section that was hidden', () => {
    const hidden = hideSection(DEFAULT_OVERVIEW_ROWS, [], 'net-worth');
    const rows = normalizeRows({ rows: hidden.overviewRows, hidden: hidden.hiddenSections });

    expect(hidden.hiddenSections).toEqual(['net-worth']);
    expect(rows.flat()).not.toContain('net-worth');
    expect(rows.flat()).toContain('goals');
  });

  it('closes the gap a hidden section leaves and puts a shown one on a row at the bottom', () => {
    const rows: OverviewRows = [['goals'], ['net-worth'], ['budgets', 'cash-runway']];
    expect(hideSection(rows, [], 'net-worth').overviewRows).toEqual([
      ['goals'],
      ['budgets', 'cash-runway'],
    ]);
    expect(showSection(rows, ['taxes'], 'taxes')).toEqual({
      overviewRows: [...rows, ['taxes']],
      hiddenSections: [],
    });
  });

  it('hides a section that is both saved in a row and marked hidden', () => {
    expect(normalizeRows({ rows: [['goals', 'crypto']], hidden: ['crypto'] })[1]).toEqual([
      'goals',
    ]);
  });
});

describe('isDefaultLayout', () => {
  it('tells a rearranged layout from the shipped one', () => {
    expect(isDefaultLayout(DEFAULT_OVERVIEW_ROWS)).toBe(true);
    expect(isDefaultLayout(moveSection(DEFAULT_OVERVIEW_ROWS, 'kpi-net', 'activity', 'below'))).toBe(
      false,
    );
  });
});
