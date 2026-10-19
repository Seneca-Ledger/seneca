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
  { key: 'date', title: 'Дата', type: CustomTableColumnType.DATE, position: 0 },
  { key: 'amount', title: 'Сумма', type: CustomTableColumnType.CURRENCY, position: 1 },
  { key: 'vendor', title: 'Контрагент', type: CustomTableColumnType.TEXT, position: 2 },
];

interface Harness {
  service: CustomTablesService;
  qb: { select: jest.Mock; groupBy: jest.Mock; having: jest.Mock; limit: jest.Mock };
}

function buildService(raw: Record<string, unknown>[] = []): Harness {
  const customTableRepository = createRepositoryMock();
  const customTableColumnRepository = createRepositoryMock();
  const customTableRowRepository = createRepositoryMock();

  customTableRepository.createQueryBuilder.mockReturnValue({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ id: TABLE_ID, name: 'Расходы' }),
  });
  customTableColumnRepository.find.mockResolvedValue(COLUMNS);

  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(raw),
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
    { createEvent: jest.fn(), createBatchEvents: jest.fn() } as never,
  );

  return { service, qb };
}

describe('CustomTablesService.findDuplicateRows', () => {
  it('returns duplicate groups with their row ids', async () => {
    const { service } = buildService([
      {
        dup_key: '2026-01-15\u001f1500\u001fмагнум',
        dup_count: '2',
        row_ids: ['a', 'b'],
        row_numbers: [3, 7],
      },
    ]);

    const result = await service.findDuplicateRows('ws-1', TABLE_ID, {
      keys: ['date', 'amount', 'vendor'],
    });

    expect(result.items[0].count).toBe(2);
    expect(result.items[0].rowIds).toEqual(['a', 'b']);
    expect(result.items[0].rowNumbers).toEqual([3, 7]);
    // Ключ показывается человекочитаемо, а не со служебным разделителем.
    expect(result.items[0].key).toBe('2026-01-15 · 1500 · магнум');
  });

  it('normalizes case and spacing so "Магнум " matches "магнум"', async () => {
    const { service, qb } = buildService([]);

    await service.findDuplicateRows('ws-1', TABLE_ID, { keys: ['vendor'] });

    const grouped = String(qb.groupBy.mock.calls.at(-1)?.[0]);
    expect(grouped).toContain('lower(');
    expect(grouped).toContain('trim(');
  });

  it('separates key parts with a control character to avoid false matches', async () => {
    const { service, qb } = buildService([]);

    await service.findDuplicateRows('ws-1', TABLE_ID, { keys: ['vendor', 'amount'] });

    // Без разделителя «аб»+«в» и «а»+«бв» дали бы одинаковый ключ.
    expect(String(qb.groupBy.mock.calls.at(-1)?.[0])).toContain('chr(31)');
  });

  it('excludes fully empty keys from the result', async () => {
    const { service, qb } = buildService([]);

    await service.findDuplicateRows('ws-1', TABLE_ID, { keys: ['vendor'] });

    const having = String(qb.having.mock.calls.at(-1)?.[0]);
    expect(having).toContain('COUNT(*) > 1');
    expect(having).toContain("<> ''");
  });

  it('clamps the group limit', async () => {
    const { service, qb } = buildService([]);

    await service.findDuplicateRows('ws-1', TABLE_ID, { keys: ['vendor'], limit: 99999 });

    expect(qb.limit).toHaveBeenCalledWith(500);
  });

  it('rejects an unknown column and an empty key', async () => {
    const { service } = buildService([]);

    await expect(
      service.findDuplicateRows('ws-1', TABLE_ID, { keys: ['ghost'] }),
    ).rejects.toMatchObject({ response: { code: 'COLUMN_NOT_FOUND_NAMED' } });
    await expect(service.findDuplicateRows('ws-1', TABLE_ID, { keys: [] })).rejects.toMatchObject({ response: { code: 'DUPLICATE_KEY_COLUMNS_REQUIRED' } });
  });
});
