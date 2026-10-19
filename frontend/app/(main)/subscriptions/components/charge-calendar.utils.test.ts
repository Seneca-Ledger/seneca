import { describe, expect, it } from 'vitest';
import { isPeakAmount, monthPeaks } from './charge-calendar.utils';

describe('isPeakAmount', () => {
  it('is false for an empty cell', () => {
    expect(isPeakAmount(0, 100)).toBe(false);
  });

  it('is true when the cell is the biggest charge that month', () => {
    expect(isPeakAmount(100, 100)).toBe(true);
  });

  it('is false when the cell is smaller than the peak', () => {
    expect(isPeakAmount(25, 100)).toBe(false);
  });

  it('stays false rather than throwing when the month is empty', () => {
    expect(isPeakAmount(0, 0)).toBe(false);
    expect(isPeakAmount(10, 0)).toBe(false);
  });
});

describe('monthPeaks', () => {
  it('takes the largest charge of each month', () => {
    const rows = [{ amounts: [10, 500] }, { amounts: [90, 5] }];
    expect(monthPeaks(rows, 2)).toEqual([90, 500]);
  });

  it('reports zero for a month nobody charges in', () => {
    expect(monthPeaks([{ amounts: [0, 0] }], 2)).toEqual([0, 0]);
  });

  it('tolerates rows shorter than the horizon', () => {
    expect(monthPeaks([{ amounts: [5] }], 3)).toEqual([5, 0, 0]);
  });
});
