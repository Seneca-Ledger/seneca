import * as xlsx from 'xlsx';
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
  { key: 'amount', title: 'Сумма', type: CustomTableColumnType.NUMBER, position: 1 },
  { key: 'paid', title: 'Оплачено', type: CustomTableColumnType.BOOLEAN, position: 2 },
  { key: 'tags', title: 'Теги', type: CustomTableColumnType.MULTI_SELECT, position: 3 },
];

const ROWS = [
  {
    id: 'row-1',
    rowNumber: 1,
    data: { date: '2026-01-15', amount: '1500.50', paid: 'true', tags: ['офис', 'аренда'] },
  },
  {
    id: 'row-2',
    rowNumber: 2,
    data: { date: '2026-02-01', amount: '20', paid: false, tags: [] },
  },
];

function buildService(
  columns: Array<Record<string, unknown>> = COLUMNS,
  table: Record<string, unknown> = { id: TABLE_ID, name: 'Отчёт' },
): {
  service: CustomTablesService;
  rowQueryBuilder: { skip: jest.Mock; take: jest.Mock };
} {
  const customTableRepository = createRepositoryMock();
  const customTableColumnRepository = createRepositoryMock();
  const customTableRowRepository = createRepositoryMock();

  customTableRepository.createQueryBuilder.mockReturnValue({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(table),
  });

  customTableColumnRepository.find.mockResolvedValue(columns);

  const rowQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(ROWS.length),
    getMany: jest.fn().mockResolvedValue(ROWS),
    clone: jest.fn(),
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
    { createEvent: jest.fn(), createBatchEvents: jest.fn() } as never,
  );

  return { service, rowQueryBuilder };
}

function readSheet(buffer: Buffer): Record<string, unknown>[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet);
}

describe('CustomTablesService.exportRows', () => {
  it('keeps numbers and booleans as native types and joins multi-select', async () => {
    const { service } = buildService();

    const result = await service.exportRows('workspace-1', TABLE_ID, { format: 'xlsx' });
    const rows = readSheet(result.buffer);

    expect(result.fileName).toContain('.xlsx');
    expect(rows[0]['Сумма']).toBe(1500.5);
    expect(rows[0]['Оплачено']).toBe(true);
    expect(rows[0]['Теги']).toBe('офис, аренда');
    expect(rows[1]['Сумма']).toBe(20);
  });

  it('exports only the requested columns, in the requested order', async () => {
    const { service } = buildService();

    const result = await service.exportRows('workspace-1', TABLE_ID, {
      format: 'xlsx',
      columnKeys: ['paid', 'date'],
    });

    const workbook = xlsx.read(result.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const grid = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    expect(grid[0]).toEqual(['Оплачено', 'Дата']);
    expect(readSheet(result.buffer)[0]['Сумма']).toBeUndefined();
  });

  it('refuses to export more rows than the in-memory cap allows', async () => {
    const { service, rowQueryBuilder } = buildService();
    rowQueryBuilder.getCount.mockResolvedValue(100_001);

    await expect(service.exportRows('workspace-1', TABLE_ID, { format: 'csv' })).rejects.toMatchObject({ response: { code: 'EXPORT_TOO_MANY_ROWS' } });
  });

  it('neutralises formula-looking column and summary titles in CSV', async () => {
    const { service } = buildService(
      [{ key: 'date', title: '=HYPERLINK("http://evil.example","x")', type: CustomTableColumnType.DATE, position: 0 }],
      {
        id: TABLE_ID,
        name: 'Отчёт',
        viewSettings: { summaries: [{ id: 's1', title: '@total', expression: 'SUM(1)' }] },
      },
    );
    jest.spyOn(service, 'getSummaries').mockResolvedValue({
      items: [{ id: 's1', title: '@total', expression: 'SUM(1)', value: '-1+cmd' }],
    } as never);

    const result = await service.exportRows('workspace-1', TABLE_ID, { format: 'csv' });
    const csv = result.buffer.toString('utf-8');

    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(csv).toContain("'@total,'-1+cmd");
    expect(csv).not.toMatch(/(^|\n|,)"?=HYPERLINK/);
  });

  it('prefixes CSV with a BOM so Excel reads Cyrillic correctly', async () => {
    const { service } = buildService();

    const result = await service.exportRows('workspace-1', TABLE_ID, { format: 'csv' });

    expect(result.buffer.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(result.contentType).toContain('text/csv');
  });
});
