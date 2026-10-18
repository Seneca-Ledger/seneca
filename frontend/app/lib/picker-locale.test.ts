import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { loadPickerLocale } from './picker-locale';

describe('loadPickerLocale', () => {
  it('gives Russian month names and placeholders', async () => {
    const { dateLocale, localeText } = await loadPickerLocale('ru');

    // Standalone month for the "month year" field, short names for the month grid.
    expect(format(new Date(2026, 9, 1), 'LLLL yyyy', { locale: dateLocale })).toBe('октябрь 2026');
    expect(format(new Date(2026, 9, 1), 'MMM', { locale: dateLocale })).toBe('окт.');
    expect(
      localeText?.fieldMonthPlaceholder?.({ contentType: 'letter', format: 'LLLL' } as never),
    ).toBe('ММММ');
  });

  it('falls back to a related date locale where date-fns has none', async () => {
    const { dateLocale, localeText } = await loadPickerLocale('hsb');

    expect(dateLocale.code).toBe('de');
    // MUI has no Upper Sorbian either: its labels stay at the English default.
    expect(localeText).toBeUndefined();
  });
});
