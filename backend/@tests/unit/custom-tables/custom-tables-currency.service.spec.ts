import type { Mock } from 'vitest';
import * as xlsx from 'xlsx';
import { CustomTableColumnType } from '../../../src/entities/custom-table-column.entity';
import { CustomTablesService } from '../../../src/modules/custom-tables/custom-tables.service';

const createRepositoryMock = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
  save: vi.fn(),
  create: vi.fn((value?: unknown) => value),
  delete: vi.fn(),
  update: vi.fn(),
  createQueryBuilder: vi.fn(),
});

const TABLE_ID = '11111111-1111-4111-8111-111111111111';

const COLUMNS = [
  {
    key: 'total',
    title: 'Итого',
    type: CustomTableColumnType.CURRENCY,
    position: 0,
    config: { currency: 'KZT', precision: 2 },
  },
  { key: 'note', title: 'Комментарий', type: CustomTableColumnType.TEXT, position: 1 },
];

const ROWS = [
  { id: 'row-1', rowNumber: 1, data: { total: '1500.50', note: 'а' } },
  { id: 'row-2', rowNumber: 2, data: { total: '20', note: 'б' } },
];

interface Harness {
  service: CustomTablesService;
  rowQueryBuilder: {
    orderBy: Mock;
    andWhere: Mock;
    select: Mock;
    getRawOne: Mock;
    getCount: Mock;
    clone: Mock;
  };
}

function buildService(raw: Record<string, unknown> = {}): Harness {
  const customTableRepository = createRepositoryMock();
  const customTableColumnRepository = createRepositoryMock();
  const customTableRowRepository = createRepositoryMock();

  customTableRepository.createQueryBuilder.mockReturnValue({
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue({ id: TABLE_ID, name: 'Бюджет' }),
  });
  customTableColumnRepository.find.mockResolvedValue(COLUMNS);

  const rowQueryBuilder = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getCount: vi.fn().mockResolvedValue(ROWS.length),
    getMany: vi.fn().mockResolvedValue(ROWS),
    getRawOne: vi.fn().mockResolvedValue(raw),
    clone: vi.fn(),
  };
  rowQueryBuilder.clone.mockReturnValue(rowQueryBuilder);
  customTableRowRepository.createQueryBuilder.mockReturnValue(rowQueryBuilder);

  const service = new CustomTablesService(
    customTableRepository as never,
    createRepositoryMock() as never,
    customTableColumnRepository as never,
    customTableRowRepository as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    { createEvent: vi.fn(), createBatchEvents: vi.fn() } as never,
  );

  return { service, rowQueryBuilder };
}

describe('currency columns behave as numbers', () => {
  it('sorts by numeric value, not by text', async () => {
    const { service, rowQueryBuilder } = buildService();

    await service.listRows('workspace-1', TABLE_ID, {
      limit: 50,
      sort: { col: 'total', dir: 'desc' },
    });

    const sortExpr = rowQueryBuilder.orderBy.mock.calls.at(-1)?.[0] as string;
    // Текстовая сортировка поставила бы '20' выше '1500.50'.
    expect(sortExpr).toContain('::numeric');
  });

  it('accepts numeric comparison filters', async () => {
    const { service, rowQueryBuilder } = buildService();

    await service.listRows('workspace-1', TABLE_ID, {
      limit: 50,
      filters: [{ col: 'total', op: 'gt', value: 100 }],
    });

    const clauses = rowQueryBuilder.andWhere.mock.calls.map(call => String(call[0]));
    expect(clauses.some(clause => clause.includes('::numeric'))).toBe(true);
  });

  it('allows sum in aggregates', async () => {
    const { service } = buildService({ agg_0: '1520.50' });

    const result = await service.aggregateRows('workspace-1', TABLE_ID, {
      aggs: [{ col: 'total', fn: 'sum' }],
    });

    expect(result.items[0]).toEqual({ col: 'total', fn: 'sum', value: 1520.5 });
  });

  it('exports as a real number so Excel can sum it', async () => {
    const { service } = buildService();

    const result = await service.exportRows('workspace-1', TABLE_ID, { format: 'xlsx' });
    const workbook = xlsx.read(result.buffer, { type: 'buffer' });
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[workbook.SheetNames[0]],
    );

    expect(rows[0]['Итого']).toBe(1500.5);
    expect(typeof rows[0]['Итого']).toBe('number');
  });
});
