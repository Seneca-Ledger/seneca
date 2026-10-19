import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddCryptoWalletBalances migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1786290000000-AddCryptoWalletBalances.ts',
  );

  const source = () => readFileSync(filePath, 'utf8');

  it('adds the column with an empty default, so existing wallets stay valid', () => {
    expect(existsSync(filePath)).toBe(true);
    const text = source();
    expect(text).toContain('ADD COLUMN IF NOT EXISTS "balances" jsonb');
    expect(text).toContain(`NOT NULL DEFAULT '[]'::jsonb`);
  });

  it('backfills nothing — balances come from the next sync, not from the transfers', () => {
    expect(source()).not.toContain('UPDATE "crypto_wallets"');
  });

  it('drops the column on the way down', () => {
    const text = source();
    const down = text.slice(text.indexOf('public async down'));
    expect(down).toContain('DROP COLUMN IF EXISTS "balances"');
  });
});
