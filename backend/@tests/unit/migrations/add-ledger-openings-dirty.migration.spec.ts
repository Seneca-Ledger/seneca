import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddLedgerOpeningsDirty migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1786450000000-AddLedgerOpeningsDirty.ts'),
    'utf8',
  );
  const up = source.slice(source.indexOf('public async up'), source.indexOf('public async down'));
  const down = source.slice(source.indexOf('public async down'));

  it('queues every workspace once, so existing wallets get their openings booked', () => {
    expect(up).toContain('ADD COLUMN IF NOT EXISTS "ledger_openings_dirty" boolean NOT NULL DEFAULT true');
  });

  // Must match what postWalletOpeningBalance() reads from a wallet.
  it.each(['workspace_id', 'initial_balance', 'currency', 'is_active'])(
    're-queues the openings when a wallet %s changes',
    column => {
      expect(up).toContain(`NEW."${column}"`);
      expect(up).toContain(`OLD."${column}"`);
    },
  );

  it('retries a failed attempt at once when a wallet changes', () => {
    expect(up).toContain('ADD COLUMN IF NOT EXISTS "ledger_openings_attempted_at"');
    expect(up).toContain('SET "ledger_openings_dirty" = true, "ledger_openings_attempted_at" = NULL');
  });

  it('also fires when a wallet is created or deleted', () => {
    expect(up).toContain('AFTER INSERT OR DELETE ON "wallets"');
  });

  it('removes everything it adds', () => {
    expect(down).toContain('DROP TRIGGER IF EXISTS "TRG_wallets_ledger_openings_update"');
    expect(down).toContain('DROP TRIGGER IF EXISTS "TRG_wallets_ledger_openings"');
    expect(down).toContain('DROP FUNCTION IF EXISTS "ledger_mark_openings_dirty"()');
    expect(down).toContain('DROP COLUMN IF EXISTS "ledger_openings_dirty"');
    expect(down).toContain('DROP COLUMN IF EXISTS "ledger_openings_attempted_at"');
  });
});
