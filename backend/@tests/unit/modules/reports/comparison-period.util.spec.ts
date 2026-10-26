import { previousPeriod } from '@/modules/reports/cash-flow-map.util';
import { comparisonPeriod, sameRangeLastYear } from '@/modules/reports/comparison-period.util';

describe('comparison windows', () => {
  it('holds a period against the one a person would pick by default', () => {
    expect(comparisonPeriod('2026-03-01', '2026-03-31')).toEqual(
      previousPeriod('2026-03-01', '2026-03-31'),
    );
    expect(comparisonPeriod('2026-03-01', '2026-03-31', 'previous')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('holds it against the same dates a year earlier when asked', () => {
    expect(comparisonPeriod('2026-03-01', '2026-03-31', 'year')).toEqual({
      from: '2025-03-01',
      to: '2025-03-31',
    });
  });

  it('lines a year up month with month rather than counting 365 days back', () => {
    // 2024 is a leap year, so "365 days" would land on 2 January.
    expect(sameRangeLastYear('2025-01-01', '2025-01-31')).toEqual({
      from: '2024-01-01',
      to: '2024-01-31',
    });
  });

  it('turns 29 February into the last day of February in an ordinary year', () => {
    expect(sameRangeLastYear('2024-02-01', '2024-02-29')).toEqual({
      from: '2023-02-01',
      to: '2023-02-28',
    });
  });
});
