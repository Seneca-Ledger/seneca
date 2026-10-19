import {
  findCoverageGaps,
  type ScoreInput,
  scoreCompleteness,
} from '@/modules/income-tax/income-tax-completeness.service';

const signals = (over: Partial<ScoreInput['signals']> = {}): ScoreInput['signals'] => ({
  transactionCount: 100,
  uncategorizedCount: 0,
  unmappedTransactionCount: 0,
  unmappedCategories: [],
  missingFxCount: 0,
  missingFxCurrencies: [],
  ...over,
});

const input = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  signals: signals(),
  coverageGaps: [],
  statementsWithErrors: 0,
  statementsPendingReview: 0,
  receiptsPendingReview: 0,
  activeDaysRatio: 0.9,
  daysSinceLastUpload: 1,
  isCurrentYear: true,
  ...over,
});

const statement = (account: string, from: string, to: string) => ({
  accountNumber: account,
  statementDateFrom: from,
  statementDateTo: to,
});

describe('findCoverageGaps', () => {
  const afterYear = new Date('2027-02-01T00:00:00Z');

  it('reports months between an account’s first statement and the year end', () => {
    const gaps = findCoverageGaps(
      [
        statement('KZ12 3456 7890', '2026-03-01', '2026-04-30'),
        statement('KZ12 3456 7890', '2026-07-01', '2026-12-31'),
      ],
      2026,
      afterYear,
    );

    expect(gaps).toEqual([{ account: '•••• 7890', months: [5, 6] }]);
  });

  it('clips statements that run over the year boundary', () => {
    const gaps = findCoverageGaps(
      [statement('A-0001', '2025-11-01', '2026-06-30'), statement('A-0001', '2026-07-01', '2027-01-31')],
      2026,
      afterYear,
    );
    expect(gaps).toEqual([]);
  });

  it('does not expect the current month’s statement yet', () => {
    const gaps = findCoverageGaps(
      [statement('A-0001', '2026-01-01', '2026-07-31')],
      2026,
      new Date('2026-09-13T00:00:00Z'),
    );
    expect(gaps).toEqual([{ account: '•••• 0001', months: [8] }]);
  });

  it('ignores statements without an account or dates, and future years', () => {
    expect(
      findCoverageGaps(
        [{ accountNumber: null, statementDateFrom: '2026-01-01', statementDateTo: '2026-01-31' }],
        2026,
        afterYear,
      ),
    ).toEqual([]);
    expect(findCoverageGaps([statement('A', '2028-01-01', '2028-01-31')], 2028, afterYear)).toEqual(
      [],
    );
  });
});

describe('scoreCompleteness', () => {
  it('scores clean, regularly tracked data at 100', () => {
    expect(scoreCompleteness(input())).toEqual({ score: 100, issues: [] });
  });

  it('treats a year with no transactions as critical', () => {
    const result = scoreCompleteness(input({ signals: signals({ transactionCount: 0 }) }));
    expect(result.score).toBe(40);
    expect(result.issues[0]).toMatchObject({ code: 'no_transactions', severity: 'critical' });
  });

  it('weighs uncategorised, unmapped and unconverted transactions by their share', () => {
    const result = scoreCompleteness(
      input({
        signals: signals({
          uncategorizedCount: 20,
          unmappedTransactionCount: 20,
          missingFxCount: 1,
          missingFxCurrencies: ['USD'],
        }),
      }),
    );

    // 100 − 30×0.2 − 25×0.2 − max(5, 15×0.01)
    expect(result.score).toBe(84);
    expect(result.issues.map(i => [i.code, i.severity])).toEqual([
      ['uncategorized_transactions', 'critical'],
      ['unmapped_categories', 'critical'],
      ['missing_exchange_rates', 'critical'],
    ]);
  });

  it('caps the penalty for missing statement months', () => {
    const result = scoreCompleteness(
      input({ coverageGaps: [{ account: '•••• 1', months: [1, 2, 3, 4, 5, 6] }] }),
    );
    expect(result.score).toBe(80);
    expect(result.issues[0]).toMatchObject({ code: 'statement_coverage_gaps', count: 6 });
  });

  it('flags irregular tracking — the basis of the daily-use disclaimer', () => {
    const result = scoreCompleteness(input({ activeDaysRatio: 0.1 }));
    expect(result.score).toBe(92);
    expect(result.issues[0]).toMatchObject({ code: 'irregular_tracking', count: 10 });
  });

  it('only calls an upload stale in the current year', () => {
    expect(scoreCompleteness(input({ daysSinceLastUpload: 30 })).issues[0]?.code).toBe(
      'stale_upload',
    );
    expect(
      scoreCompleteness(input({ daysSinceLastUpload: 300, isCurrentYear: false })).issues,
    ).toEqual([]);
  });

  it('never goes below zero', () => {
    const result = scoreCompleteness(
      input({
        signals: signals({ transactionCount: 0, missingFxCount: 5 }),
        coverageGaps: [{ account: 'x', months: [1, 2, 3, 4, 5] }],
        statementsWithErrors: 3,
        receiptsPendingReview: 9,
        activeDaysRatio: 0,
      }),
    );
    expect(result.score).toBe(0);
  });
});
