import type { Mock } from 'vitest';
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
  { key: 'vendor', title: 'Контрагент', type: CustomTableColumnType.TEXT, position: 0 },
  { key: 'total', title: 'Итого', type: CustomTableColumnType.CURRENCY, position: 1 },
];

interface Harness {
  service: CustomTablesService;
  qb: {
    select: Mock;
    groupBy: Mock;
    orderBy: Mock;
    limit: Mock;
    getRawMany: Mock;
    setParameter: Mock;
  };
}

function buildService(rawGroups: Record<string, unknown>[] = []): Harness {
  const customTableRepository = createRepositoryMock();
  const customTableColumnRepository = createRepositoryMock();
  const customTableRowRepository = createRepositoryMock();

  customTableRepository.createQueryBuilder.mockReturnValue({
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue({ id: TABLE_ID, name: 'Расходы' }),
  });
  customTableColumnRepository.find.mockResolvedValue(COLUMNS);

  const qb = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getCount: vi.fn().mockResolvedValue(0),
    getRawMany: vi.fn().mockResolvedValue(rawGroups),
  };
  customTableRowRepository.createQueryBuilder.mockReturnValue(qb);

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

  return { service, qb };
}

describe('CustomTablesService.groupRows', () => {
  it('returns groups with counts and per-group aggregates', async () => {
    const { service } = buildService([
      { group_key: 'Magnum', group_count: '3', agg_0: '4500.75' },
      { group_key: 'Small', group_count: '1', agg_0: '20' },
    ]);

    const result = await service.groupRows('workspace-1', TABLE_ID, {
      groupBy: 'vendor',
      aggs: [{ col: 'total', fn: 'sum' }],
    });

    expect(result.items[0]).toEqual({
      key: 'Magnum',
      count: 3,
      aggregates: [{ col: 'total', fn: 'sum', value: 4500.75 }],
    });
    expect(result.groupCount).toBe(2);
  });

  it('keeps empty cells as a null group instead of dropping them', async () => {
    const { service } = buildService([{ group_key: null, group_count: '2' }]);

    const result = await service.groupRows('workspace-1', TABLE_ID, { groupBy: 'vendor' });

    expect(result.items[0].key).toBeNull();
    expect(result.items[0].count).toBe(2);
  });

  it('clamps the group limit', async () => {
    const { service, qb } = buildService([]);

    await service.groupRows('workspace-1', TABLE_ID, { groupBy: 'vendor', limit: 99999 });

    expect(qb.limit).toHaveBeenCalledWith(1000);
  });

  it('rejects grouping by an unknown column', async () => {
    const { service } = buildService([]);

    await expect(
      service.groupRows('workspace-1', TABLE_ID, { groupBy: 'ghost' }),
    ).rejects.toMatchObject({ response: { code: 'GROUP_COLUMN_NOT_FOUND' } });
  });

  it('rejects an aggregate the column type cannot support', async () => {
    const { service } = buildService([]);

    await expect(
      service.groupRows('workspace-1', TABLE_ID, {
        groupBy: 'vendor',
        aggs: [{ col: 'vendor', fn: 'sum' }],
      }),
    ).rejects.toMatchObject({ response: { code: 'AGG_FUNCTION_UNSUPPORTED' } });
  });
});
