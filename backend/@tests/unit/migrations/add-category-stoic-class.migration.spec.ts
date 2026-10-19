import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddCategoryStoicClass migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1786600000000-AddCategoryStoicClass.ts',
  );

  it('adds the stoic class column to categories', () => {
    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain('ALTER TABLE "categories"');
    expect(source).toContain('ADD COLUMN IF NOT EXISTS "stoic_class" varchar(16)');
  });

  it('adds it as nullable, so an unjudged category stays a suggestion', () => {
    const source = readFileSync(filePath, 'utf8');
    expect(source).not.toContain('NOT NULL');
  });

  it('drops the column on the way down', () => {
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain('DROP COLUMN IF EXISTS "stoic_class"');
  });
});
