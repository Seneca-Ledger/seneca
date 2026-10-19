import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddLedgerBaseCurrency migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1786430000000-AddLedgerBaseCurrency.ts'),
    'utf8',
  );
  const up = source.slice(source.indexOf('public async up'), source.indexOf('public async down'));

  it('adds a nullable base currency, so every workspace starts with the ledger off', () => {
    expect(up).toContain('ADD COLUMN IF NOT EXISTS "ledger_base_currency" character varying(10)');
    expect(up).not.toMatch(/"ledger_base_currency" character varying\(10\) NOT NULL/);
    expect(up).not.toMatch(/DEFAULT/);
  });

  it('never guesses a base currency for existing workspaces', () => {
    expect(up).not.toContain('UPDATE "workspaces"');
  });

  it('accepts only ISO-style codes', () => {
    expect(up).toContain(`"ledger_base_currency" ~ '^[A-Z]{3}$'`);
  });
});
