import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddLedgerCryptoAccounts migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1786460000000-AddLedgerCryptoAccounts.ts'),
    'utf8',
  );
  const up = source.slice(source.indexOf('public async up'), source.indexOf('public async down'));
  const down = source.slice(source.indexOf('public async down'));

  it('keeps an account when its crypto wallet is deleted, so its entries can be reversed', () => {
    expect(up).toContain('REFERENCES "crypto_wallets"("id") ON DELETE SET NULL');
  });

  it('opens one live account per crypto wallet', () => {
    expect(up).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_accounts_crypto_wallet"');
    expect(up).toContain('WHERE "crypto_wallet_id" IS NOT NULL AND "deleted_at" IS NULL');
  });

  it('queues the crypto rows that were skipped before', () => {
    expect(up).toMatch(/SET "ledger_dirty" = true[\s\S]*WHERE "crypto_wallet_id" IS NOT NULL/);
  });

  it('removes everything it adds', () => {
    expect(down).toContain('DROP INDEX IF EXISTS "UQ_ledger_accounts_crypto_wallet"');
    expect(down).toContain('DROP CONSTRAINT IF EXISTS "FK_ledger_accounts_crypto_wallet"');
    expect(down).toContain('DROP COLUMN IF EXISTS "crypto_wallet_id"');
  });
});
