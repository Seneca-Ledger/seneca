vi.mock('franc', () => ({
  franc: () => 'und',
}));

import {
  ConvertedToStatement,
  CreatedFromSource,
  CustomTableColumnItem,
  CustomTableDetail,
  MessageResult,
  OkResult,
  RestoredTableDefault,
} from '../../src/contracts';
import {
  CustomTableColumnStyle,
  CustomTableDuplicates,
  CustomTableRelationOptions,
  PaidClassification,
} from '../../src/contracts/custom-tables/custom-table-actions';
import {
  CustomTableShareCreated,
  CustomTableShareList,
  ExportScheduleItem,
  ExportScheduleList,
  RowCommentCounts,
  RowCommentItem,
  RowCommentList,
} from '../../src/contracts/custom-tables/custom-table-collab';
import { type ContractApp, seedManualExpense, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail } from './helpers/e2e-app';

/**
 * The custom-tables answers against their contracts, each with rows in it, so
 * a contract that only matches empty answers does not pass.
 */
describe('API contracts: custom tables (e2e)', () => {
  const email = `contracts-tables-${Date.now()}@example.com`;
  let ctx: ContractApp;
  const call: ContractApp['call'] = (...args) => ctx.call(...args);
  const answer: ContractApp['answer'] = (...args) => ctx.answer(...args);

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Tables Owner');
    await seedManualExpense(ctx, 'ACME Store - Wireless Buds');
  });

  afterAll(async () => {
    if (ctx) {
      await deleteUserByEmail(ctx.dataSource, email);
      await ctx.app.close();
    }
  });

  describe('a manual table', () => {
    let tableId: string;
    const keys: Record<string, string> = {};
    const columnIds: string[] = [];
    const rowIds: string[] = [];

    beforeAll(async () => {
      tableId = (await call('post', '/custom-tables', { name: 'Shop costs' }).expect(201)).body.id;
      for (const [title, type] of [
        ['Date', 'date'],
        ['Amount', 'number'],
        ['Vendor', 'text'],
      ]) {
        const column = await call('post', `/custom-tables/${tableId}/columns`, { title, type });
        keys[title] = column.body.key;
        columnIds.push(column.body.id);
      }
      for (const amount of [120.5, 30, 30]) {
        const row = await call('post', `/custom-tables/${tableId}/rows`, {
          data: { [keys.Date]: '2026-10-01', [keys.Amount]: amount, [keys.Vendor]: 'ACME Store' },
        }).expect(201);
        rowIds.push(row.body.id);
      }
    });

    it('row comments', async () => {
      const url = `/custom-tables/${tableId}/rows/${rowIds[0]}/comments`;
      const added = await answer(RowCommentItem, call('post', url, { body: 'Check the receipt' }));
      expect(added.author?.name).toBe('Tables Owner');
      expect((await answer(RowCommentList, call('get', url))).items).toHaveLength(1);
      const counts = await answer(RowCommentCounts, call('get', `/custom-tables/${tableId}/comment-counts`));
      expect(counts.counts[rowIds[0]]).toBe(1);
      const commentUrl = `/custom-tables/${tableId}/comments/${added.id}`;
      const resolved = await answer(RowCommentItem, call('patch', commentUrl, { resolved: true }));
      expect(resolved.resolvedAt).not.toBeNull();
      await answer(MessageResult, call('delete', commentUrl));
    });

    it('shares and export schedules', async () => {
      const share = await answer(CustomTableShareCreated, call('post', `/custom-tables/${tableId}/shares`, {}));
      const shares = await answer(CustomTableShareList, call('get', `/custom-tables/${tableId}/shares`));
      expect(shares.items.map(item => item.id)).toContain(share.id);
      await answer(MessageResult, call('delete', `/custom-tables/${tableId}/shares/${share.id}`));

      const scheduleUrl = `/custom-tables/${tableId}/export-schedules`;
      const schedule = await answer(ExportScheduleItem, call('post', scheduleUrl, { format: 'csv' }));
      expect(schedule.lastRunAt).toBeNull();
      expect((await answer(ExportScheduleList, call('get', scheduleUrl))).items).toHaveLength(1);
      await answer(MessageResult, call('delete', `${scheduleUrl}/${schedule.id}`));
    });

    it('columns: edit, style, reorder, relation options', async () => {
      const columnUrl = `/custom-tables/${tableId}/columns/${columnIds[2]}`;
      const renamed = await answer(CustomTableColumnItem, call('patch', columnUrl, { title: 'Shop' }));
      expect(renamed.title).toBe('Shop');
      const style = await answer(
        CustomTableColumnStyle,
        call('patch', `${columnUrl}/style`, { header: { textFormat: { bold: true } } }),
      );
      expect(style.columnKey).toBe(keys.Vendor);
      await answer(
        OkResult,
        call('post', `/custom-tables/${tableId}/columns/reorder`, { columnIds: [...columnIds].reverse() }),
      );

      const target = (await call('post', '/custom-tables', { name: 'Shops' }).expect(201)).body.id;
      const name = await call('post', `/custom-tables/${target}/columns`, { title: 'Name', type: 'text' });
      await call('post', `/custom-tables/${target}/rows`, { data: { [name.body.key]: 'ACME Store' } }).expect(201);
      const link = await call('post', `/custom-tables/${tableId}/columns`, {
        title: 'Shop link',
        type: 'relation',
        config: { targetTableId: target, displayColumnKey: name.body.key },
      }).expect(201);
      const options = await answer(
        CustomTableRelationOptions,
        call('get', `/custom-tables/${tableId}/relation-options?column=${link.body.key}`),
      );
      expect(options.items[0]?.label).toBe('ACME Store');
      await answer(OkResult, call('delete', `/custom-tables/${tableId}/columns/${link.body.id}`));
    });

    it('duplicates and paid status', async () => {
      const duplicates = await answer(
        CustomTableDuplicates,
        call('get', `/custom-tables/${tableId}/duplicates?keys=${keys.Amount}`),
      );
      expect(duplicates.meta.groupCount).toBeGreaterThan(0);
      const paid = await answer(
        PaidClassification,
        call('post', `/custom-tables/${tableId}/rows/paid-classify`, { rowIds }),
      );
      expect(paid.items).toHaveLength(rowIds.length);
    });

    it('view settings answer the table', async () => {
      const base = `/custom-tables/${tableId}/view-settings`;
      for (const [path, body] of [
        ['summaries', { summaries: [{ title: 'Total', expression: `SUM([${keys.Amount}])` }] }],
        ['rules', { rules: [{ col: keys.Amount, target: 'cell', op: 'gt', value: 50 }] }],
        ['views', { views: [{ id: 'mine', name: 'Mine' }], activeViewId: 'mine' }],
        ['columns', { columnKey: keys.Amount, width: 200, aggregate: 'sum' }],
      ] as const) {
        const table = await answer(CustomTableDetail, call('patch', `${base}/${path}`, body));
        expect(table.columns.length).toBeGreaterThan(0);
      }
    });

    it('delete a row, convert to a statement, delete the table', async () => {
      // Two identical rows would make two identical transactions: drop the copy first.
      await answer(OkResult, call('delete', `/custom-tables/${tableId}/rows/${rowIds[2]}`));
      const converted = await answer(
        ConvertedToStatement,
        call('post', `/custom-tables/${tableId}/convert-to-statement`),
      );
      expect(converted.importedRows).toBe(2);
      await answer(OkResult, call('delete', `/custom-tables/${tableId}`));
    });
  });

  it('restore a source table to its default', async () => {
    const created = await answer(
      CreatedFromSource,
      call('post', '/custom-tables/from-source', { kind: 'transactions', name: 'From source' }),
    );
    const restored = await answer(
      RestoredTableDefault,
      call('post', `/custom-tables/${created.tableId}/restore-default`),
    );
    expect(restored.rows).toBeGreaterThan(0);
  });
});
