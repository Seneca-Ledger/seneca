import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddReceiptLocation migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1786340000000-AddReceiptLocation.ts',
  );
  const read = () => readFileSync(filePath, 'utf8');

  it('adds the resolved location columns to receipts', () => {
    expect(existsSync(filePath)).toBe(true);
    const source = read();
    for (const column of [
      'location_lat',
      'location_lng',
      'location_source',
      'location_accuracy_m',
      'location_updated_at',
    ]) {
      expect(source).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
  });

  it('guards source values, coordinate ranges and half-written points', () => {
    const source = read();
    expect(source).toContain('"CHK_receipts_location_source"');
    expect(source).toContain('"CHK_receipts_location_range"');
    expect(source).toContain('"CHK_receipts_location_pair"');
    expect(source).toContain("'fiscal_qr'");
  });

  it('stores the map style preference on users', () => {
    expect(read()).toContain('ADD COLUMN IF NOT EXISTS "map_style_preference"');
  });

  it('leaves existing rows untouched and reverses everything on the way down', () => {
    const source = read();
    expect(source).not.toMatch(/\bUPDATE\s+"/);
    expect(source).not.toContain('DELETE FROM');
    expect(source).not.toContain('NOT NULL');
    expect(source).toContain('DROP COLUMN IF EXISTS "map_style_preference"');
    expect(source).toContain('DROP CONSTRAINT IF EXISTS "CHK_receipts_location_pair"');
    expect(source).toContain('DROP COLUMN IF EXISTS "location_lat"');
  });
});
