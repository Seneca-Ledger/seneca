import { InvoiceRecurrenceInterval } from '@/entities/invoice.entity';
import {
  advanceIssueDate,
  shiftDueDate,
} from '@/modules/invoices/invoice-recurrence.util';

const { WEEKLY, MONTHLY, QUARTERLY, YEARLY } = InvoiceRecurrenceInterval;

describe('advanceIssueDate', () => {
  it('adds a week, a month, a quarter and a year to a mid-month date', () => {
    expect(advanceIssueDate('2026-03-10', WEEKLY)).toBe('2026-03-17');
    expect(advanceIssueDate('2026-03-10', MONTHLY)).toBe('2026-04-10');
    expect(advanceIssueDate('2026-03-10', QUARTERLY)).toBe('2026-06-10');
    expect(advanceIssueDate('2026-03-10', YEARLY)).toBe('2027-03-10');
  });

  it('clamps to the end of a shorter month instead of skipping it', () => {
    // The bug this replaces: 31 January + 1 month landed on 3 March, so the
    // client was never billed for February at all.
    expect(advanceIssueDate('2026-01-31', MONTHLY)).toBe('2026-02-28');
    expect(advanceIssueDate('2026-03-31', MONTHLY)).toBe('2026-04-30');
    expect(advanceIssueDate('2026-01-31', QUARTERLY)).toBe('2026-04-30');
  });

  it('keeps billing on the anchor day after a clamped month', () => {
    const anchor = '2026-01-31';
    const february = advanceIssueDate(anchor, MONTHLY, anchor);
    expect(february).toBe('2026-02-28');
    // Without the anchor the series would stay on the 28th for good.
    expect(advanceIssueDate(february, MONTHLY, anchor)).toBe('2026-03-31');
    expect(advanceIssueDate(february, MONTHLY)).toBe('2026-03-28');
  });

  it('clamps 29 February to 28 February on a non-leap year', () => {
    expect(advanceIssueDate('2028-02-29', YEARLY)).toBe('2029-02-28');
    expect(advanceIssueDate('2028-02-29', MONTHLY)).toBe('2028-03-29');
  });

  it('crosses a year boundary', () => {
    expect(advanceIssueDate('2026-12-31', MONTHLY)).toBe('2027-01-31');
    expect(advanceIssueDate('2026-11-30', QUARTERLY)).toBe('2027-02-28');
  });
});

describe('shiftDueDate', () => {
  it('keeps the issue-to-due gap of the original invoice', () => {
    expect(shiftDueDate('2026-01-10', '2026-02-09', '2026-02-10')).toBe('2026-03-12');
    expect(shiftDueDate('2026-01-10', '2026-01-10', '2026-02-10')).toBe('2026-02-10');
  });
});
