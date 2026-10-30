import {
  type LayoutFirstSeen,
  type ParseRecord,
  summarizeParserHealth,
} from '@/modules/parsing/helpers/parser-health.helper';

const now = new Date('2026-10-28T12:00:00Z');
const since = new Date('2026-09-28T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const usual = {
  fingerprint: 'aaaaaaaaaaaa',
  headings: ['date:date | description:particulars | debit:debit | credit:credit | balance:balance'],
  unknownWords: [],
};
const renamed = {
  fingerprint: 'bbbbbbbbbbbb',
  headings: ['date:date | description:narration | debit:debit | credit:credit | balance:balance'],
  unknownWords: ['narration'],
};

const record = (overrides: Partial<ParseRecord>): ParseRecord => ({
  bank: 'axis',
  status: 'completed',
  errorMessage: null,
  createdAt: daysAgo(10),
  parser: 'AxisParser',
  layout: usual,
  ...overrides,
});

describe('summarizeParserHealth', () => {
  const firstSeen: LayoutFirstSeen[] = [
    { bank: 'axis', fingerprint: usual.fingerprint, firstSeen: daysAgo(200) },
    { bank: 'axis', fingerprint: renamed.fingerprint, firstSeen: daysAgo(2) },
  ];

  it("counts each bank's statements, those held for review and why, and failures", () => {
    const health = summarizeParserHealth(
      [
        record({}),
        record({ status: 'needs_review', reasonCodes: ['balance_chain', 'printed_totals'] }),
        record({ status: 'needs_review', reasonCodes: ['balance_chain'] }),
        record({ status: 'error', errorMessage: 'Statement file could not be read', layout: undefined }),
        // Confirmed by its owner: no longer held, though its codes stay.
        record({ status: 'completed', reasonCodes: ['balance_mismatch'] }),
      ],
      firstSeen,
      since,
      now,
    );
    expect(health.since).toBe(since.toISOString());
    expect(health.banks).toEqual([
      expect.objectContaining({
        bank: 'axis',
        statements: 5,
        needsReview: 2,
        errors: 1,
        declined: 0,
        reasons: [
          { code: 'balance_chain', count: 2 },
          { code: 'printed_totals', count: 1 },
        ],
      }),
    ]);
  });

  it('marks a layout first seen lately as new, when the bank came in another before', () => {
    const health = summarizeParserHealth(
      [record({ createdAt: daysAgo(20) }), record({ layout: renamed, createdAt: daysAgo(2) })],
      firstSeen,
      since,
      now,
    );
    const [axis] = health.banks;
    expect(axis.layouts.map(layout => [layout.fingerprint, layout.isNew, layout.statements])).toEqual([
      [usual.fingerprint, false, 1],
      [renamed.fingerprint, true, 1],
    ]);
    expect(axis.layouts[1]).toMatchObject({
      headings: renamed.headings,
      unknownWords: ['narration'],
      parser: 'AxisParser',
      firstSeen: daysAgo(2).toISOString(),
      lastSeen: daysAgo(2).toISOString(),
    });
  });

  it('stops calling a layout new a week after it was first seen', () => {
    const health = summarizeParserHealth(
      [record({ layout: renamed })],
      [firstSeen[0], { ...firstSeen[1], firstSeen: daysAgo(20) }],
      since,
      now,
    );
    expect(health.banks[0].layouts[0].isNew).toBe(false);
  });

  it("does not call a bank's first layout new", () => {
    const health = summarizeParserHealth(
      [record({ bank: 'bank_of_china', layout: { ...usual, fingerprint: 'cccccccccccc' } })],
      [{ bank: 'bank_of_china', fingerprint: 'cccccccccccc', firstSeen: daysAgo(1) }],
      since,
      now,
    );
    expect(health.banks[0].layouts[0].isNew).toBe(false);
  });

  it("counts a file its bank's parser declined under that bank", () => {
    const health = summarizeParserHealth(
      [
        // Named Axis, read by the generic parser: Axis's own parser did not take it.
        record({ bank: 'other', parser: 'GenericPdfParser', layout: { ...renamed, mentionedBank: 'axis' } }),
        // Kaspi recognised, and no parser took the file.
        record({ bank: 'kaspi', status: 'error', errorMessage: 'No parser found for bank kaspi', layout: undefined }),
      ],
      firstSeen,
      since,
      now,
    );
    const byBank = Object.fromEntries(health.banks.map(bank => [bank.bank, bank]));
    expect(byBank.axis).toMatchObject({ statements: 0, declined: 1 });
    expect(byBank.other).toMatchObject({ statements: 1, declined: 0 });
    expect(byBank.kaspi).toMatchObject({ statements: 1, errors: 1, declined: 1 });
  });
});
