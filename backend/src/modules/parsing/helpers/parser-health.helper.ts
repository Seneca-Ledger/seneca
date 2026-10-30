import type { ParserHealth, ParserHealthBank, ParserHealthLayout } from '../../../contracts';

/**
 * What one parsed statement tells about its parser: never a figure, a name or
 * a description, only its bank, outcome and layout words.
 */
export interface ParseRecord {
  bank: string;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  parser?: string;
  reasonCodes?: string[];
  layout?: {
    fingerprint: string;
    headings: string[];
    unknownWords: string[];
    mentionedBank?: string;
  };
}

/** When a layout was first seen for a bank, over all statements ever parsed. */
export interface LayoutFirstSeen {
  bank: string;
  fingerprint: string;
  firstSeen: Date;
}

/** A layout first seen this lately is new, if the bank's files came in another one before. */
export const NEW_LAYOUT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The bank was recognised, but none of the parsers took the file. */
const NO_PARSER = /^No parser found/;

const OTHER_BANK = 'other';

interface BankTally extends Omit<ParserHealthBank, 'reasons' | 'layouts'> {
  reasons: Map<string, number>;
  layouts: Map<string, Omit<ParserHealthLayout, 'firstSeen' | 'isNew'> & { lastSeenAt: Date }>;
}

const emptyTally = (bank: string): BankTally => ({
  bank,
  statements: 0,
  needsReview: 0,
  errors: 0,
  declined: 0,
  reasons: new Map(),
  layouts: new Map(),
});

/** The bank a file named whose parser did not take it: read generically, or not at all. */
function declinedBank(record: ParseRecord): string | null {
  if (record.bank === OTHER_BANK && record.layout?.mentionedBank) {
    return record.layout.mentionedBank;
  }
  return record.status === 'error' && NO_PARSER.test(record.errorMessage ?? '')
    ? record.bank
    : null;
}

function addLayout(tally: BankTally, record: ParseRecord) {
  const { layout } = record;
  if (!layout) {
    return;
  }
  const seen = tally.layouts.get(layout.fingerprint);
  tally.layouts.set(layout.fingerprint, {
    fingerprint: layout.fingerprint,
    parser: record.parser ?? 'unknown',
    headings: layout.headings,
    unknownWords: layout.unknownWords,
    statements: (seen?.statements ?? 0) + 1,
    lastSeen: '',
    lastSeenAt: seen && seen.lastSeenAt > record.createdAt ? seen.lastSeenAt : record.createdAt,
  });
}

function addRecord(tallyOf: (bank: string) => BankTally, record: ParseRecord) {
  const tally = tallyOf(record.bank);
  const held = record.status === 'needs_review';
  tally.statements += 1;
  tally.needsReview += held ? 1 : 0;
  tally.errors += record.status === 'error' ? 1 : 0;
  for (const code of held ? (record.reasonCodes ?? []) : []) {
    tally.reasons.set(code, (tally.reasons.get(code) ?? 0) + 1);
  }
  const declined = declinedBank(record);
  if (declined) {
    tallyOf(declined).declined += 1;
  }
  addLayout(tally, record);
}

const byCount = <T extends { statements: number }>(a: T, b: T) => b.statements - a.statements;

/**
 * How each bank's statements parsed within the window: how many, how many
 * held for review and why, how many failed or were declined by their bank's
 * parser, and the layouts their files came in, a layout seen for the first
 * time marked new.
 */
export function summarizeParserHealth(
  records: ParseRecord[],
  firstSeen: LayoutFirstSeen[],
  since: Date,
  now: Date,
): ParserHealth {
  const tallies = new Map<string, BankTally>();
  const tallyOf = (bank: string) => {
    const tally = tallies.get(bank) ?? emptyTally(bank);
    tallies.set(bank, tally);
    return tally;
  };
  for (const record of records) {
    addRecord(tallyOf, record);
  }
  const newSince = now.getTime() - NEW_LAYOUT_DAYS * DAY_MS;
  const banks = [...tallies.values()].map(tally => ({
    bank: tally.bank,
    statements: tally.statements,
    needsReview: tally.needsReview,
    errors: tally.errors,
    declined: tally.declined,
    reasons: [...tally.reasons]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    layouts: [...tally.layouts.values()]
      .map(({ lastSeenAt, ...layout }) => {
        const first =
          firstSeen.find(
            entry => entry.bank === tally.bank && entry.fingerprint === layout.fingerprint,
          )?.firstSeen ?? lastSeenAt;
        const hadAnother = firstSeen.some(
          entry =>
            entry.bank === tally.bank &&
            entry.fingerprint !== layout.fingerprint &&
            entry.firstSeen < first,
        );
        return {
          ...layout,
          firstSeen: first.toISOString(),
          lastSeen: lastSeenAt.toISOString(),
          isNew: hadAnother && first.getTime() >= newSince,
        };
      })
      .sort(byCount),
  }));
  return { since: since.toISOString(), banks: banks.sort(byCount) };
}
