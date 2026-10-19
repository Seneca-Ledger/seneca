import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Behaviour is proven against Postgres in
// @tests/integration/ledger-double-entry.spec.ts; this pins the text so an edit
// that weakens a guarantee shows up in review even where no database is at hand.
describe('CreateLedger migration', () => {
  const filePath = path.join(process.cwd(), 'src', 'migrations', '1786420000000-CreateLedger.ts');

  const source = () => readFileSync(filePath, 'utf8');
  const up = () => source().slice(source().indexOf('public async up'), source().indexOf('public async down'));
  const down = () => source().slice(source().indexOf('public async down'));

  it('creates the four ledger tables', () => {
    expect(existsSync(filePath)).toBe(true);
    for (const table of ['ledger_accounts', 'ledger_counters', 'journal_entries', 'journal_lines']) {
      expect(up()).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
  });

  it('stores money as numeric(15,2) and rates as numeric(18,8)', () => {
    const text = up();
    for (const column of ['debit', 'credit', 'base_debit', 'base_credit']) {
      expect(text).toContain(`"${column}" numeric(15,2) NOT NULL DEFAULT 0`);
    }
    expect(text).toContain('"fx_rate" numeric(18,8) NOT NULL DEFAULT 1');
  });

  it('checks the balance at COMMIT, on lines and on the draft-to-posted switch', () => {
    const text = up();
    expect(text).toContain('CREATE CONSTRAINT TRIGGER "TRG_journal_lines_balanced"');
    expect(text).toContain('CREATE CONSTRAINT TRIGGER "TRG_journal_entries_balanced"');
    expect(text.match(/DEFERRABLE INITIALLY DEFERRED\s+FOR EACH ROW/g)).toHaveLength(2);
    expect(text).toContain('AFTER INSERT OR UPDATE OF "status" ON "journal_entries"');
    expect(text).toContain('unbalanced by');
  });

  it('freezes booked entries and their lines', () => {
    const text = up();
    expect(text).toContain('CREATE TRIGGER "TRG_journal_lines_immutable"');
    expect(text).toContain('CREATE TRIGGER "TRG_journal_entries_immutable"');
  });

  it('keeps ledger history when its sources disappear', () => {
    const text = up();
    expect(text).toContain('REFERENCES "transactions"("id") ON DELETE SET NULL');
    expect(text).toContain('REFERENCES "categories"("id") ON DELETE SET NULL');
    expect(text).toContain('REFERENCES "branches"("id") ON DELETE SET NULL');
    expect(text).toMatch(
      /FK_journal_lines_account"\s+FOREIGN KEY \("account_id"\) REFERENCES "ledger_accounts"\("id"\) ON DELETE NO ACTION\s+DEFERRABLE INITIALLY DEFERRED/,
    );
    expect(text).not.toMatch(/"ledger_accounts"\("id"\) ON DELETE CASCADE/);
  });

  it('allows one live entry per transaction but not per reversal', () => {
    expect(up()).toContain(
      `WHERE "status" = 'posted' AND "source" = 'transaction' AND "reversal_of_id" IS NULL`,
    );
  });

  it('adds only nullable columns to existing tables and rewrites no rows', () => {
    const text = up();
    expect(text).toContain('ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "ledger_account_id" uuid');
    expect(text).not.toMatch(/UPDATE "(categories|transactions|workspaces)"/);
    expect(text).not.toMatch(/DELETE FROM/);
  });

  it('reverts everything it created except the audit enum values', () => {
    const text = down();
    for (const table of ['journal_lines', 'journal_entries', 'ledger_counters', 'ledger_accounts']) {
      expect(text).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
    expect(text).toContain('DROP COLUMN IF EXISTS "ledger_account_id"');
    expect(text).not.toContain('DROP TYPE');
  });
});
