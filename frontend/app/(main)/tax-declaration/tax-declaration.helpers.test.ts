import { describe, expect, it } from 'vitest';
import {
  deHomeOfficeAllowance,
  exportFileName,
  formatLineRef,
  issueTarget,
  linesForCategory,
  parseStep,
  parseTaxYear,
  suggestionEntries,
  taxYearOptions,
} from './tax-declaration.helpers';
import type { CategoryMapping, FormLine } from './tax-declaration.types';

const now = new Date('2026-09-13T12:00:00');

describe('tax declaration helpers', () => {
  it('falls back to the first step for an unknown step', () => {
    expect(parseStep('draft')).toBe('draft');
    expect(parseStep('nope')).toBe('profile');
    expect(parseStep(null)).toBe('profile');
  });

  it('defaults to the previous, finished year and accepts only offered years', () => {
    expect(taxYearOptions(now)).toEqual([2026, 2025, 2024, 2023]);
    expect(parseTaxYear(null, now)).toBe(2025);
    expect(parseTaxYear('2026', now)).toBe(2026);
    expect(parseTaxYear('1999', now)).toBe(2025);
  });

  it('points issues at the place they are fixed', () => {
    expect(issueTarget('unmapped_categories')).toEqual({ kind: 'step', step: 'mapping' });
    expect(issueTarget('statement_coverage_gaps')).toEqual({
      kind: 'route',
      href: '/statements?upload=1',
    });
    expect(issueTarget('irregular_tracking')).toBeNull();
  });

  it('formats line and field references', () => {
    expect(formatLineRef('15', '112')).toBe('15 · 112');
    expect(formatLineRef('31–38', null)).toBe('31–38');
    expect(formatLineRef(null, null)).toBe('—');
  });

  it('offers a category only lines of its own direction and the exclusion line', () => {
    const lines = [
      { key: 'in', section: 'income' },
      { key: 'out', section: 'expense' },
      { key: 'skip', section: 'excluded' },
    ] as FormLine[];

    expect(linesForCategory(lines, 'expense').map(l => l.key)).toEqual(['out', 'skip']);
  });

  it('turns only suggestions into confirmations', () => {
    const categories = [
      { categoryId: 'a', status: 'suggested', lineKey: 'rent' },
      { categoryId: 'b', status: 'confirmed', lineKey: 'rent' },
      { categoryId: 'c', status: 'unmapped', lineKey: null },
    ] as CategoryMapping[];

    expect(suggestionEntries(categories)).toEqual([{ categoryId: 'a', lineKey: 'rent' }]);
  });

  it('names exported files by country and year', () => {
    expect(exportFileName('DE', 2025, 'pdf')).toBe('income-tax-de-2025.pdf');
  });
});

describe('deHomeOfficeAllowance', () => {
  it('pays 6 € a day up to the 1 260 € cap, reached at 210 days', () => {
    expect(deHomeOfficeAllowance({ homeOfficeDays: 100 })).toEqual({
      amount: 600,
      basis: 'days',
      units: 100,
      capped: false,
      exclusive: false,
    });
    expect(deHomeOfficeAllowance({ homeOfficeDays: 210 })).toMatchObject({
      amount: 1260,
      capped: true,
    });
    expect(deHomeOfficeAllowance({ homeOfficeDays: 300 })).toMatchObject({
      amount: 1260,
      capped: true,
    });
  });

  it('pays the annual study rate pro rata by month, 105 € for each month short of 12', () => {
    expect(deHomeOfficeAllowance({ homeStudyMonths: 12 })).toMatchObject({
      amount: 1260,
      basis: 'study',
      capped: true,
    });
    expect(deHomeOfficeAllowance({ homeStudyMonths: 8 })).toMatchObject({ amount: 840 });
  });

  it('counts only the study when both are entered, and says so', () => {
    expect(deHomeOfficeAllowance({ homeOfficeDays: 50, homeStudyMonths: 3 })).toMatchObject({
      amount: 315,
      basis: 'study',
      exclusive: true,
    });
  });

  it('ignores empty, negative and fractional input the way the server does', () => {
    expect(deHomeOfficeAllowance({})).toMatchObject({ amount: 0, basis: null });
    expect(deHomeOfficeAllowance({ homeOfficeDays: -5 })).toMatchObject({ amount: 0 });
    expect(deHomeOfficeAllowance({ homeOfficeDays: 10.9 })).toMatchObject({ amount: 60 });
  });
});
