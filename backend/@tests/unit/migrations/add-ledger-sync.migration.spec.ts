import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddLedgerSync migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1786440000000-AddLedgerSync.ts'),
    'utf8',
  );
  const up = source.slice(source.indexOf('public async up'), source.indexOf('public async down'));

  it('queues every existing row by default, so enabling the ledger books the whole history', () => {
    expect(up).toContain('ADD COLUMN IF NOT EXISTS "ledger_dirty" boolean NOT NULL DEFAULT true');
    expect(up).toContain('WHERE "ledger_dirty"');
  });

  // Must match postingFingerprint() in ledger-posting.service.ts: a fact the
  // entry is built from but missing here would change without re-posting.
  it.each([
    'workspace_id',
    'transaction_type',
    'amount',
    'debit',
    'credit',
    'currency',
    'transaction_date',
    'tax_amount',
    'tax_reverse_charge',
    'tax_notional_amount',
    'is_duplicate',
    'crypto_wallet_id',
    'category_id',
    'branch_id',
    'statement_id',
    'wallet_id',
  ])('re-queues a row when %s changes', column => {
    const trigger = up.slice(up.indexOf('ledger_mark_transaction_dirty'), up.indexOf('TRG_transactions_ledger_dirty'));
    expect(trigger).toContain(`NEW."${column}"`);
    expect(trigger).toContain(`OLD."${column}"`);
  });

  it('fires in the writing transaction, for every write path', () => {
    expect(up).toContain('BEFORE INSERT OR UPDATE ON "transactions"');
    expect(up).toContain('AFTER UPDATE ON "statements"');
    expect(up).toContain('AFTER UPDATE ON "categories"');
    expect(up).not.toMatch(/DEFERRABLE/);
  });

  it('re-queues rows of a trashed statement and of every sub-category of a moved one', () => {
    expect(up).toMatch(/NEW\."deleted_at", NEW\."bank_name"/);
    expect(up).toContain('WITH RECURSIVE subtree');
  });
});
