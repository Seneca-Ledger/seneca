import { CustomTableColumnType } from '../../../src/entities/custom-table-column.entity';
import { CustomTableMoneyTotalService } from '../../../src/modules/custom-tables/custom-table-money-total.service';

const WORKSPACE_ID = 'ws-1';
const TABLE_ID = '11111111-1111-4111-8111-111111111111';

const amountColumn = {
  key: 'col_amount',
  type: CustomTableColumnType.CURRENCY,
  position: 3,
  config: { currency: 'USD', source: { kind: 'app_field', field: 'amount' } },
};
const currencyColumn = {
  key: 'col_currency',
  type: CustomTableColumnType.TEXT,
  position: 6,
  config: { source: { kind: 'app_field', field: 'currency' } },
};
const noteColumn = { key: 'col_note', type: CustomTableColumnType.TEXT, position: 1, config: {} };

const build = (opts: {
  columns: unknown[];
  groups?: Array<{ key: string | null; sum: string | number | null }>;
  sum?: string | number | null;
  rates?: Record<string, number | null>;
}) => {
  const tables = {
    getTable: vi.fn().mockResolvedValue({ id: TABLE_ID, columns: opts.columns }),
    groupRows: vi.fn().mockResolvedValue({
      items: (opts.groups ?? []).map(g => ({
        key: g.key,
        count: 1,
        aggregates: [{ col: amountColumn.key, fn: 'sum', value: g.sum }],
      })),
      groupCount: opts.groups?.length ?? 0,
    }),
    aggregateRows: vi.fn().mockResolvedValue({
      items: [{ col: amountColumn.key, fn: 'sum', value: opts.sum ?? null }],
      total: 1,
    }),
  };
  const rates = {
    getRateOrNull: vi.fn(async (from: string) => opts.rates?.[from] ?? null),
  };
  const workspaceCurrency = { resolve: vi.fn().mockResolvedValue('USD') };
  const service = new CustomTableMoneyTotalService(
    tables as never,
    rates as never,
    workspaceCurrency as never,
  );
  return { service, tables, rates };
};

describe('CustomTableMoneyTotalService', () => {
  it('sums the money column per currency and converts it into the workspace currency', async () => {
    const usd = 1200.5;
    const eur = -40;
    const eurToUsd = 1.1;
    const { service, tables } = build({
      columns: [noteColumn, amountColumn, currencyColumn],
      groups: [
        { key: 'USD', sum: String(usd) },
        { key: 'eur', sum: eur },
      ],
      rates: { EUR: eurToUsd },
    });

    const result = await service.getTotal(WORKSPACE_ID, TABLE_ID);

    expect(tables.groupRows).toHaveBeenCalledWith(WORKSPACE_ID, TABLE_ID, {
      groupBy: currencyColumn.key,
      aggs: [{ col: amountColumn.key, fn: 'sum' }],
      limit: 1000,
    });
    expect(result).toEqual({
      column: amountColumn.key,
      currency: 'USD',
      total: Math.round((usd + eur * eurToUsd) * 100) / 100,
      missing: [],
    });
  });

  it('leaves out a currency without a rate instead of counting it 1:1', async () => {
    const { service } = build({
      columns: [amountColumn, currencyColumn],
      groups: [
        { key: 'USD', sum: 100 },
        { key: 'XYZ', sum: 5000 },
      ],
    });

    const result = await service.getTotal(WORKSPACE_ID, TABLE_ID);

    expect(result.total).toBe(100);
    expect(result.missing).toEqual(['XYZ']);
  });

  it("reads rows without a code in the column's own currency", async () => {
    const gbpToUsd = 1.25;
    const { service } = build({
      columns: [{ ...amountColumn, config: { currency: 'GBP' } }, currencyColumn],
      groups: [{ key: '', sum: 80 }],
      rates: { GBP: gbpToUsd },
    });

    expect((await service.getTotal(WORKSPACE_ID, TABLE_ID)).total).toBe(80 * gbpToUsd);
  });

  it('sums the whole column when the table has no currency column', async () => {
    const { service, tables } = build({ columns: [amountColumn], sum: '42.10' });

    const result = await service.getTotal(WORKSPACE_ID, TABLE_ID);

    expect(tables.groupRows).not.toHaveBeenCalled();
    expect(result.total).toBe(42.1);
  });

  it('has no total for a table without a money column', async () => {
    const { service, tables } = build({ columns: [noteColumn] });

    expect(await service.getTotal(WORKSPACE_ID, TABLE_ID)).toEqual({
      column: null,
      currency: 'USD',
      total: null,
      missing: [],
    });
    expect(tables.aggregateRows).not.toHaveBeenCalled();
  });
});
