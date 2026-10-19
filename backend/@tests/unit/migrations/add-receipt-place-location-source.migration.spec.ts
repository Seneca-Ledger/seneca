import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AddReceiptPlaceLocationSource1786900000000 } from '@/migrations/1786900000000-AddReceiptPlaceLocationSource';

describe('AddReceiptPlaceLocationSource migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1786900000000-AddReceiptPlaceLocationSource.ts'),
    'utf8',
  );

  const run = async (direction: 'up' | 'down') => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new AddReceiptPlaceLocationSource1786900000000()[direction]({ query } as never);
    return query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
  };

  it('recreates the source check with place and keeps every earlier value', async () => {
    const [drop, add] = await run('up');

    expect(drop).toContain('DROP CONSTRAINT IF EXISTS "CHK_receipts_location_source"');
    expect(add).toContain('ADD CONSTRAINT "CHK_receipts_location_source"');
    for (const value of ['merchant_address', 'exif', 'device', 'manual', 'fiscal_qr', 'place']) {
      expect(add).toContain(`'${value}'`);
    }
  });

  it('turns picked places into manual points before restoring the old check', async () => {
    const [update, drop, add] = await run('down');

    expect(update).toBe(
      `UPDATE "receipts" SET "location_source" = 'manual' WHERE "location_source" = 'place'`,
    );
    expect(drop).toContain('DROP CONSTRAINT IF EXISTS "CHK_receipts_location_source"');
    expect(add).not.toContain("'place'");
    expect(add).toContain("'fiscal_qr'");
  });

  it('touches no other table', () => {
    expect(source).not.toMatch(/ALTER TABLE "(?!receipts")/);
  });
});
