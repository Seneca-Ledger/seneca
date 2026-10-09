import { CustomTableColumnType } from '../../../src/entities/custom-table-column.entity';
import {
  FormulaRecalcService,
  RECALC_SYNC_ROW_LIMIT,
} from '../../../src/modules/custom-tables/formula-recalc.service';

const TABLE_ID = '11111111-1111-4111-8111-111111111111';

const columns = [
  { key: 'col_amount', type: CustomTableColumnType.NUMBER, config: null },
  {
    key: 'col_share',
    type: CustomTableColumnType.FORMULA,
    config: { expression: '[col_amount] / SUM([col_amount])' },
  },
];

const build = (rows: Array<Record<string, unknown>>, withQueue = false) => {
  const rowRepository = {
    count: jest.fn().mockResolvedValue(rows.length),
    find: jest.fn().mockResolvedValue(rows),
    query: jest.fn().mockResolvedValue(undefined),
  };
  const columnRepository = { find: jest.fn().mockResolvedValue(columns) };
  const queue = withQueue ? { add: jest.fn().mockResolvedValue(undefined) } : undefined;
  const service = new FormulaRecalcService(
    rowRepository as never,
    columnRepository as never,
    queue as never,
  );
  return { service, rowRepository, columnRepository, queue };
};

describe('FormulaRecalcService', () => {
  it('writes only rows whose computed values changed, in one statement', async () => {
    const { service, rowRepository } = build([
      { id: 'r1', rowNumber: 1, data: { col_amount: 100 }, computed: { col_share: 0.25 } },
      { id: 'r2', rowNumber: 2, data: { col_amount: 300 }, computed: {} },
    ]);

    const result = await service.recalcTable(TABLE_ID);

    expect(result).toEqual({ rows: 2, updated: 1 });
    expect(rowRepository.query).toHaveBeenCalledTimes(1);
    const [sql, params] = rowRepository.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE custom_table_rows AS r SET computed = v\.computed/);
    expect(params).toEqual(['r2', JSON.stringify({ col_share: 0.75 })]);
  });

  it('clears stale computed values when the table has no formula columns', async () => {
    const { service, rowRepository, columnRepository } = build([
      { id: 'r1', rowNumber: 1, data: {}, computed: { col_old: 1 } },
    ]);
    columnRepository.find.mockResolvedValue([columns[0]]);

    await service.recalcTable(TABLE_ID);

    expect(rowRepository.query.mock.calls[0][1]).toEqual(['r1', '{}']);
  });

  it('runs inline for small tables and queues big ones', async () => {
    const small = build([{ id: 'r1', rowNumber: 1, data: { col_amount: 1 }, computed: {} }], true);
    expect(await small.service.scheduleRecalc(TABLE_ID, 'ws')).toBe('sync');
    expect(small.queue?.add).not.toHaveBeenCalled();

    const big = build([], true);
    big.rowRepository.count.mockResolvedValue(RECALC_SYNC_ROW_LIMIT + 1);
    expect(await big.service.scheduleRecalc(TABLE_ID, 'ws')).toBe('queued');
    expect(big.queue?.add).toHaveBeenCalledWith(
      'recalc',
      { tableId: TABLE_ID, workspaceId: 'ws' },
      expect.objectContaining({ jobId: expect.stringContaining(`recalc-${TABLE_ID}`) }),
    );
  });

  it('falls back to an inline recalc when the queue is unavailable', async () => {
    const { service, rowRepository, queue } = build([], true);
    rowRepository.count.mockResolvedValue(RECALC_SYNC_ROW_LIMIT + 1);
    queue?.add.mockRejectedValue(new Error('redis down'));
    expect(await service.scheduleRecalc(TABLE_ID, 'ws')).toBe('sync');
    expect(rowRepository.find).toHaveBeenCalled();
  });
});
