import { describe, expect, it } from 'vitest';
import { LEADERBOARD_ROW_LIMIT, rowsWithFocused } from './focus-rows';

type Row = { name: string };

const idOf = (row: Row): string => `merchant:${row.name}`;
const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ name: `m${index}` }));

const overLimit = LEADERBOARD_ROW_LIMIT + 5;

describe('rowsWithFocused', () => {
  it('draws the top of the ranking when nothing is focused', () => {
    expect(rowsWithFocused(rows(overLimit), idOf, null)).toHaveLength(LEADERBOARD_ROW_LIMIT);
  });

  it('adds the focused row when the ranking cut it off', () => {
    // Otherwise the ring from an advice link waits for a row that is never
    // drawn, and the click looks ignored.
    const visible = rowsWithFocused(rows(overLimit), idOf, `merchant:m${overLimit - 1}`);

    expect(visible).toHaveLength(LEADERBOARD_ROW_LIMIT + 1);
    expect(visible.at(-1)).toEqual({ name: `m${overLimit - 1}` });
  });

  it('does not repeat a focused row that is already in view', () => {
    expect(rowsWithFocused(rows(overLimit), idOf, 'merchant:m1')).toHaveLength(
      LEADERBOARD_ROW_LIMIT,
    );
  });

  it('draws the plain top when the focused row is in no month of the data', () => {
    expect(rowsWithFocused(rows(overLimit), idOf, 'merchant:gone')).toHaveLength(
      LEADERBOARD_ROW_LIMIT,
    );
  });
});
