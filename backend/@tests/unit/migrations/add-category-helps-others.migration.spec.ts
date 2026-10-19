import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddCategoryHelpsOthers migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1786610000000-AddCategoryHelpsOthers.ts',
  );

  it('adds a nullable helps_others flag to categories', () => {
    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain('ADD COLUMN IF NOT EXISTS "helps_others" boolean');
    expect(source).not.toContain('NOT NULL');
  });

  it('drops the column on the way down', () => {
    expect(readFileSync(filePath, 'utf8')).toContain('DROP COLUMN IF EXISTS "helps_others"');
  });
});
