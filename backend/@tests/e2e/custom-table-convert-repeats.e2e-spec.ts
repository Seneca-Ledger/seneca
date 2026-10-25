vi.mock('franc', () => ({ franc: () => 'und' }));

import { ConvertedToStatement } from '../../src/contracts';
import { type ContractApp, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail } from './helpers/e2e-app';

/**
 * Identical rows convert the way identical statement lines import: every row is
 * kept, a repeat is flagged as a duplicate (out of the unique fingerprint index
 * and the totals) and reported, never a 500.
 */
describe('Custom table to statement with identical rows (e2e)', () => {
  const email = `convert-repeats-${Date.now()}@example.com`;
  const vendor = 'ACME Store - Wireless Buds';
  let ctx: ContractApp;
  const call: ContractApp['call'] = (...args) => ctx.call(...args);

  const tableWithRows = async (name: string, amounts: number[]): Promise<string> => {
    const tableId = (await call('post', '/custom-tables', { name }).expect(201)).body.id;
    const keys: Record<string, string> = {};
    for (const [title, type] of [
      ['Date', 'date'],
      ['Amount', 'number'],
      ['Vendor', 'text'],
    ]) {
      keys[title] = (await call('post', `/custom-tables/${tableId}/columns`, { title, type })).body.key;
    }
    for (const amount of amounts) {
      await call('post', `/custom-tables/${tableId}/rows`, {
        data: { [keys.Date]: '2026-10-01', [keys.Amount]: amount, [keys.Vendor]: vendor },
      }).expect(201);
    }
    return tableId;
  };

  const rowsOf = (statementId: string) =>
    ctx.dataSource.query(
      `SELECT amount, is_duplicate, duplicate_of_id FROM transactions
       WHERE statement_id = $1 ORDER BY amount, is_duplicate`,
      [statementId],
    ) as Promise<Array<{ amount: string; is_duplicate: boolean; duplicate_of_id: string | null }>>;

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Member One');
  });

  afterAll(async () => {
    if (ctx) {
      await deleteUserByEmail(ctx.dataSource, email);
      await ctx.app.close();
    }
  });

  it('keeps both identical rows, flags the repeat and says so, also when converted again', async () => {
    const tableId = await tableWithRows('Shop costs', [30, 30, 120.5]);
    const url = `/custom-tables/${tableId}/convert-to-statement`;

    for (const _ of [1, 2]) {
      const converted = await ctx.answer(ConvertedToStatement, call('post', url));
      expect(converted.importedRows).toBe(3);
      expect(converted.warnings).toEqual([expect.stringMatching(/^row \d+ flagged as duplicate/)]);
      const rows = await rowsOf(converted.statementId);
      expect(rows.map(row => [Number(row.amount), row.is_duplicate])).toEqual([
        [30, false],
        [30, true],
        [120.5, false],
      ]);
    }
  });

  it('flags a row that repeats a transaction already in the workspace', async () => {
    const first = await ctx.answer(
      ConvertedToStatement,
      call('post', `/custom-tables/${await tableWithRows('First', [55])}/convert-to-statement`),
    );
    const second = await ctx.answer(
      ConvertedToStatement,
      call('post', `/custom-tables/${await tableWithRows('Second', [55])}/convert-to-statement`),
    );

    const [original] = await ctx.dataSource.query(
      'SELECT id FROM transactions WHERE statement_id = $1',
      [first.statementId],
    );
    const [repeat] = await rowsOf(second.statementId);
    expect(repeat).toMatchObject({ is_duplicate: true, duplicate_of_id: original.id });
  });
});
