import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddGoalCover migration', () => {
  const filePath = path.join(process.cwd(), 'src', 'migrations', '1786700000000-AddGoalCover.ts');

  const source = () => readFileSync(filePath, 'utf8');

  it('adds every cover column without touching existing rows', () => {
    expect(existsSync(filePath)).toBe(true);
    const text = source();
    for (const column of ['cover_preset', 'cover_file', 'cover_attribution', 'cover_source_url']) {
      expect(text).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
    expect(text).not.toContain('UPDATE "goals"');
  });

  it('leaves every column nullable, so goals made before this keep no cover', () => {
    const up = source().slice(source().indexOf('public async up'), source().indexOf('public async down'));
    expect(up).not.toContain('NOT NULL');
    expect(up).not.toContain('DEFAULT');
  });

  it('reverses itself', () => {
    const down = source().slice(source().indexOf('public async down'));
    for (const column of ['cover_preset', 'cover_file', 'cover_attribution', 'cover_source_url']) {
      expect(down).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
  });
});
