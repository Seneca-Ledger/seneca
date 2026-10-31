import { describe, expect, it } from 'vitest';
import {
  canTeach,
  isAreaBigEnough,
  missingGroups,
  nextTag,
  rectBetween,
  regionWarning,
  type TeachRegion,
  withRegion,
  wordsInRegion,
} from './teach-utils';

const area = (tag: TeachRegion['tag'], x0 = 0, x1 = 10): TeachRegion => ({
  tag,
  page: 1,
  x0,
  y0: 0,
  x1,
  y1: 10,
});

describe('teach-utils', () => {
  it('offers teaching for a PDF the parser failed on or read wrong, not for one it read', () => {
    const pdf = { fileType: 'pdf', status: 'error' };
    expect(canTeach(pdf)).toBe(true);
    expect(canTeach({ ...pdf, fileType: 'csv' })).toBe(false);
    expect(canTeach({ ...pdf, source: 'scan' })).toBe(false);
    expect(canTeach({ ...pdf, status: 'completed' })).toBe(false);
    const review = (code: string) => ({
      ...pdf,
      status: 'needs_review',
      parsingDetails: { validation: { reasonCodes: [code] } },
    });
    expect(canTeach(review('nothing_extracted'))).toBe(true);
    expect(canTeach(review('balance_chain'))).toBe(true);
    // A balance that does not reconcile is the user's to confirm, not a layout to teach.
    expect(canTeach(review('balance_mismatch'))).toBe(false);
  });

  it('names the groups still to mark and draws the first of them next', () => {
    expect(missingGroups([])).toEqual([['date'], ['description'], ['debit', 'credit', 'amount']]);
    const marked = [area('date'), area('credit')];
    expect(missingGroups(marked)).toEqual([['description']]);
    expect(nextTag(marked, 'credit')).toBe('description');
    expect(nextTag([...marked, area('description')], 'balance')).toBe('balance');
  });

  it('takes the words whose middle lies inside an area on its page', () => {
    const word = { text: 'Date', page: 1, x: 2, y: 2, width: 6, height: 4, dated: false };
    expect(wordsInRegion([word], area('date', 0, 10))).toEqual([word]);
    expect(wordsInRegion([word], area('date', 0, 4))).toEqual([]);
    expect(wordsInRegion([{ ...word, page: 2 }], area('date', 0, 10))).toEqual([]);
  });

  it('turns a drag either way into an area, and a click into none', () => {
    const rect = rectBetween({ x: 30, y: 40 }, { x: 10, y: 5 });
    expect(rect).toEqual({ x0: 10, y0: 5, x1: 30, y1: 40 });
    expect(isAreaBigEnough(rect)).toBe(true);
    expect(isAreaBigEnough(rectBetween({ x: 10, y: 10 }, { x: 11, y: 30 }))).toBe(false);
  });

  it('adds a column drawn again, and moves a figure printed once', () => {
    const first = area('date', 0, 10);
    const second = area('date', 20, 30);
    expect(withRegion([first, area('credit')], second)).toEqual([first, area('credit'), second]);
    expect(withRegion([area('skip')], area('skip', 5, 9))).toHaveLength(2);
    const opening = area('openingBalance', 0, 10);
    const moved = area('openingBalance', 20, 30);
    expect(withRegion([opening, area('credit')], moved)).toEqual([area('credit'), moved]);
  });

  it('warns of a column tag off the table and a one-figure tag over a column', () => {
    const word = (text: string, x: number, y: number, dated = y >= 100) => ({
      text,
      page: 1,
      x,
      y,
      width: 20,
      height: 6,
      dated,
    });
    const words = [
      word('Northwind', 40, 20),
      // "02 Sep": the parser's reading of the line decides, not the word's shape.
      word('02', 40, 100),
      word('Sep', 55, 100),
      word('ACME', 120, 100),
      word('987.50', 300, 100),
      word('03', 40, 120),
      word('Sep', 55, 120),
      word('1,087.50', 300, 120),
    ];
    const on = (tag: TeachRegion['tag'], x0: number, y0: number, x1: number, y1: number) => ({
      tag,
      page: 1,
      x0,
      y0,
      x1,
      y1,
    });
    expect(regionWarning(on('date', 30, 10, 80, 30), words)).toBe('notColumn');
    expect(regionWarning(on('date', 30, 95, 80, 130), words)).toBeNull();
    // A cell of a transaction row is enough: its line starts with a date.
    expect(regionWarning(on('description', 110, 95, 150, 108), words)).toBeNull();
    expect(regionWarning(on('closingBalance', 290, 95, 330, 130), words)).toBe('notOneFigure');
    expect(regionWarning(on('closingBalance', 290, 115, 330, 130), words)).toBeNull();
  });
});
