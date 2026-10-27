import {
  detectNumericDateOrder,
  findFullDates,
  parseDateParts,
  resolveDate,
} from '@/modules/parsing/helpers/statement-date.helper';

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('statement-date.helper', () => {
  it.each([
    ['17/01/2025', 'dmy', { day: 17, month: 1, year: 2025 }],
    ['09/13', 'mdy', { day: 13, month: 9, year: undefined }],
    ['01.05', 'dmy', { day: 1, month: 5, year: undefined }],
    ['2025-05-31', 'dmy', { day: 31, month: 5, year: 2025 }],
    ['1 mei', 'dmy', { day: 1, month: 5, year: undefined }],
    ['02 janv. 25', 'dmy', { day: 2, month: 1, year: 2025 }],
    ['31 janvier 2025', 'dmy', { day: 31, month: 1, year: 2025 }],
    ['1er février 2025', 'dmy', { day: 1, month: 2, year: 2025 }],
    ['3 März', 'dmy', { day: 3, month: 3, year: undefined }],
    ['Sep 3, 2025', 'dmy', { day: 3, month: 9, year: 2025 }],
    ['14 dic', 'dmy', { day: 14, month: 12, year: undefined }],
  ] as const)('reads %s', (text, order, expected) => {
    expect(parseDateParts(text, order)).toEqual(expected);
  });

  it.each(['8373579', '13/13', '1 Sep Faster', 'Paynow', '38.2gal', '1.450,77'])(
    'does not read %s as a date',
    text => {
      expect(parseDateParts(text, 'dmy')).toBeNull();
    },
  );

  it('settles day/month order from a component that can only be a day', () => {
    expect(detectNumericDateOrder(['01/01/2025', '17/01/2025'])).toBe('dmy');
    expect(detectNumericDateOrder(['09/01', '09/13'])).toBe('mdy');
    expect(detectNumericDateOrder(['01/02', '03/04'])).toBeNull();
  });

  it('gives a yearless date the statement year, or the year before across a new year', () => {
    const closedInJanuary = new Date(2026, 0, 10);
    expect(iso(resolveDate({ day: 28, month: 12 }, closedInJanuary))).toBe('2025-12-28');
    expect(iso(resolveDate({ day: 5, month: 1 }, closedInJanuary))).toBe('2026-01-05');
    expect(iso(resolveDate({ day: 5, month: 1, year: 2024 }, closedInJanuary))).toBe('2024-01-05');
  });

  it('finds dates with a year in free text, in order', () => {
    const text = 'Période du 1 janvier 2025 au 31.01.2025, émis le 2025-02-03';
    expect(findFullDates(text, 'dmy').map(found => iso(found.date))).toEqual([
      '2025-01-01',
      '2025-01-31',
      '2025-02-03',
    ]);
  });
});
