import { CustomTableColumnType } from '../../../src/entities/custom-table-column.entity';
import { CustomTablesService } from '../../../src/modules/custom-tables/custom-tables.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((value?: unknown) => value),
  delete: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const TABLE_ID = '11111111-1111-4111-8111-111111111111';

const COLUMNS = [
  { key: 'amount', title: 'Сумма', type: CustomTableColumnType.NUMBER, position: 0 },
  { key: 'date', title: 'Дата', type: CustomTableColumnType.DATE, position: 1 },
  { key: 'note', title: 'Комментарий', type: CustomTableColumnType.TEXT, position: 2 },
];

interface Harness {
  service: CustomTablesService;
  rowQueryBuilder: {
    select: jest.Mock;
    getRawOne: jest.Mock;
    getCount: jest.Mock;
    orderBy: jest.Mock;
    setParameter: jest.Mock;
  };
}

function buildService(raw: Record<string, unknown> = {}): Harness {
  const customTableRepository = createRepositoryMock();
  const customTableColumnRepository = createRepositoryMock();
  const customTableRowRepository = createRepositoryMock();

  customTableRepository.createQueryBuilder.mockReturnValue({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ id: TABLE_ID, name: 'Отчёт' }),
  });
  customTableColumnRepository.find.mockResolvedValue(COLUMNS);

  const rowQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(3),
    getRawOne: jest.fn().mockResolvedValue(raw),
  };
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
    { createEvent: jest.fn(), createBatchEvents: jest.fn() } as never,
  );

  return { service, rowQueryBuilder };
}

describe('CustomTablesService.aggregateRows', () => {
  it('returns numeric aggregates computed by the database', async () => {
    const { service, rowQueryBuilder } = buildService({ agg_0: '1520.50', agg_1: '3' });

    const result = await service.aggregateRows('workspace-1', TABLE_ID, {
      aggs: [
        { col: 'amount', fn: 'sum' },
        { col: 'note', fn: 'count' },
      ],
    });

    expect(result.items).toEqual([
      { col: 'amount', fn: 'sum', value: 1520.5 },
      { col: 'note', fn: 'count', value: 3 },
    ]);
    // Итог считается по всей выборке, а не по окну строк грида.
    expect(result.total).toBe(3);
    expect(rowQueryBuilder.skip).not.toHaveBeenCalled();
    expect(rowQueryBuilder.take).not.toHaveBeenCalled();
  });

  it('drops ORDER BY before aggregating', async () => {
    const { service, rowQueryBuilder } = buildService({ agg_0: '10' });

    await service.aggregateRows('workspace-1', TABLE_ID, {
      aggs: [{ col: 'amount', fn: 'sum' }],
    });

    // Postgres не допускает ORDER BY по колонке вне агрегата без GROUP BY.
    expect(rowQueryBuilder.orderBy).toHaveBeenCalledWith();
  });

  it('formats date min/max as plain dates', async () => {
    const { service } = buildService({ agg_0: new Date('2026-02-01T00:00:00.000Z') });

    const result = await service.aggregateRows('workspace-1', TABLE_ID, {
      aggs: [{ col: 'date', fn: 'min' }],
    });

    expect(result.items[0].value).toBe('2026-02-01');
  });

  it('rejects sum on a text column instead of returning nonsense', async () => {
    const { service } = buildService();

    await expect(
      service.aggregateRows('workspace-1', TABLE_ID, { aggs: [{ col: 'note', fn: 'sum' }] }),
    ).rejects.toMatchObject({ response: { code: 'AGG_FUNCTION_UNSUPPORTED' } });
  });

  it('rejects an unknown column', async () => {
    const { service } = buildService();

    await expect(
      service.aggregateRows('workspace-1', TABLE_ID, { aggs: [{ col: 'ghost', fn: 'sum' }] }),
    ).rejects.toMatchObject({ response: { code: 'AGG_COLUMN_NOT_FOUND' } });
  });

  it('returns nothing when no aggregates were requested', async () => {
    const { service } = buildService();

    await expect(service.aggregateRows('workspace-1', TABLE_ID, { aggs: [] })).resolves.toEqual({
      items: [],
      total: 0,
    });
  });
});
