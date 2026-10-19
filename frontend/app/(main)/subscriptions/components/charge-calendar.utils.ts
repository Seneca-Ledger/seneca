/** Whether a cell is the largest charge in its month column, so it can print bold. */
export const isPeakAmount = (amount: number, monthPeak: number): boolean =>
  amount > 0 && monthPeak > 0 && amount === monthPeak;

/** The largest single charge in each month, used to scale that column's tint. */
export const monthPeaks = (rows: { amounts: number[] }[], months: number): number[] =>
  Array.from({ length: months }, (_, index) =>
    rows.reduce((peak, row) => Math.max(peak, row.amounts[index] ?? 0), 0),
  );
