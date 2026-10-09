import type { QueryRunner } from 'typeorm';
import { AddDisposalAttribution1786980000000 } from '../../../src/migrations/1786980000000-AddDisposalAttribution';

const run = async (direction: 'up' | 'down'): Promise<string> => {
  const sql: string[] = [];
  const queryRunner = { query: jest.fn(async (statement: string) => sql.push(statement)) };
  await new AddDisposalAttribution1786980000000()[direction](
    queryRunner as unknown as QueryRunner,
  );
  return sql.join('\n');
};

describe('AddDisposalAttribution migration', () => {
  it('copies the purchase day from the lot a sale still points at', async () => {
    const up = await run('up');
    expect(up).toContain('UPDATE "metal_sales" s');
    expect(up).toContain('SET "acquired_on" = h."acquired_on"');
    expect(up).toContain('WHERE h."id" = s."lot_id"');
    // Only where it is still missing: a hand-corrected date is not overwritten.
    expect(up).toContain('s."acquired_on" IS NULL');
  });

  it('fills in an owner only where the workspace has exactly one member', async () => {
    const up = await run('up');
    // The guard is the whole point: attributing one member's sale to another
    // would put a stranger's gain on a person's tax return.
    expect(up).toContain('HAVING COUNT(*) = 1');
    expect(up).toContain('UPDATE "investment_holdings" h');
    expect(up).toContain('UPDATE "metal_sales" s');
    expect(up).toContain('"owner_user_id" IS NULL');
  });

  it('keeps the owner pointing at a real user, and lets the user go', async () => {
    const up = await run('up');
    expect(up).toContain('REFERENCES "users"("id") ON DELETE SET NULL');
  });

  it('takes both columns away again on the way down', async () => {
    const down = await run('down');
    expect(down).toContain('DROP COLUMN IF EXISTS "owner_user_id"');
    expect(down).toContain('DROP COLUMN IF EXISTS "acquired_on"');
  });
});
