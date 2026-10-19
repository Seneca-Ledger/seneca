import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AllowLedgerRevaluationLines migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1786470000000-AllowLedgerRevaluationLines.ts'),
    'utf8',
  );
  const up = source.slice(source.indexOf('public async up'), source.indexOf('public async down'));
  const down = source.slice(source.indexOf('public async down'));

  it('accepts a line with no document amount only with exactly one base side', () => {
    expect(up).toContain(
      '("debit" = 0 AND "credit" = 0 AND ("base_debit" = 0) <> ("base_credit" = 0))',
    );
  });

  it('keeps such lines to revaluations, in a foreign currency', () => {
    expect(up).toContain(`v_entry.source <> 'fx_revaluation' OR "currency" = v_entry.base_currency`);
    // Every check of the original trigger survives the rewrite.
    for (const check of ['a booked entry needs at least two', 'unbalanced by', 'not postable here']) {
      expect(up).toContain(check);
    }
  });

  it('allows one live revaluation per workspace and day', () => {
    expect(up).toContain('"UQ_journal_entries_live_revaluation"');
    expect(up).toContain(`WHERE "source" = 'fx_revaluation' AND "status" = 'posted' AND "reversal_of_id" IS NULL`);
  });

  it('restores the original checks and trigger', () => {
    expect(down).toContain('DROP INDEX IF EXISTS "UQ_journal_entries_live_revaluation"');
    expect(down).toContain('CHECK (("debit" = 0) <> ("credit" = 0))');
    expect(down).not.toContain('fx_revaluation');
  });
});
