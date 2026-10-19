import type { QueryRunner } from 'typeorm';
import { LedgerDirtyOnConfirmation1786910000000 } from '../../../src/migrations/1786910000000-LedgerDirtyOnConfirmation';

const run = async (direction: 'up' | 'down'): Promise<string> => {
  const sql: string[] = [];
  const queryRunner = { query: jest.fn(async (statement: string) => sql.push(statement)) };
  await new LedgerDirtyOnConfirmation1786910000000()[direction](
    queryRunner as unknown as QueryRunner,
  );
  return sql.join('\n');
};

describe('LedgerDirtyOnConfirmation migration', () => {
  it('re-queues a row for the ledger when it is confirmed or unconfirmed', async () => {
    const up = await run('up');
    expect(up).toContain('CREATE OR REPLACE FUNCTION "ledger_mark_transaction_dirty"()');
    expect(up).toContain('NEW."wallet_id", NEW."is_verified")');
    expect(up).toContain('OLD."wallet_id", OLD."is_verified")');
  });

  it('keeps every fact the original trigger watched', async () => {
    const up = await run('up');
    for (const column of ['is_duplicate', 'category_id', 'statement_id', 'transaction_date']) {
      expect(up).toContain(`NEW."${column}"`);
      expect(up).toContain(`OLD."${column}"`);
    }
  });

  it('restores the previous function on the way down', async () => {
    const down = await run('down');
    expect(down).toContain('NEW."wallet_id")');
    expect(down).not.toContain('is_verified');
  });
});
