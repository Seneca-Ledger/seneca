import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddUserShowDailyQuote migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1786650000000-AddUserShowDailyQuote.ts',
  );

  it('adds show_daily_quote defaulting to on, so no existing screen changes', () => {
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf8')).toContain(
      'ADD COLUMN IF NOT EXISTS "show_daily_quote" boolean NOT NULL DEFAULT true',
    );
  });

  it('drops the column on the way down', () => {
    expect(readFileSync(filePath, 'utf8')).toContain('DROP COLUMN IF EXISTS "show_daily_quote"');
  });
});
