import {
  CustomTableColumnType,
  type CustomTableColumn,
} from '../../../../src/entities/custom-table-column.entity';
import { AuditService } from '../../../../src/modules/audit/audit.service';
import { ReportsService } from '../../../../src/modules/reports/reports.service';

function createRepoMock() {
  return {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  } as any;
}

describe('ReportsService custom tables report', () => {
  let service: ReportsService;

  beforeEach(() => {
    service = new ReportsService(
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as unknown as AuditService,
      createRepoMock(),
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );
  });

  it('returns proper shape for empty workspace', async () => {
    const result = await service.getCustomTablesReport('workspace-1', {} as any);

    expect(result).toHaveProperty('totals');
    expect(result).toHaveProperty('comparison');
    expect(result).toHaveProperty('timeseries');
    expect(result).toHaveProperty('sourceSplit');
    expect(result).toHaveProperty('aggregatedRows');
    expect(result).toHaveProperty('tables');
    expect(result.totals.total).toBe(0);
    expect(result.aggregatedRows).toEqual([]);
  });

  it('groups rows by counterparty, source, and currency', async () => {
    const customTableRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'table-1',
          workspaceId: 'workspace-1',
          name: 'Manual Table',
          source: 'manual',
          category: null,
        },
        {
          id: 'table-2',
          workspaceId: 'workspace-1',
          name: 'Second Table',
          source: 'manual',
          category: null,
        },
      ]),
    } as any;

    const customTableColumnRepository = {
      find: jest.fn().mockResolvedValue([
        {
          tableId: 'table-1',
          key: 'date',
          title: 'Date',
          type: CustomTableColumnType.DATE,
          position: 0,
        },
        {
          tableId: 'table-1',
          key: 'amount',
          title: 'Amount',
          type: CustomTableColumnType.NUMBER,
          position: 1,
        },
        {
          tableId: 'table-1',
          key: 'counterparty',
          title: 'Counterparty',
          type: CustomTableColumnType.TEXT,
          position: 2,
        },
        {
          tableId: 'table-1',
          key: 'currency',
          title: 'Currency',
          type: CustomTableColumnType.TEXT,
          position: 3,
        },
        {
          tableId: 'table-2',
          key: 'date',
          title: 'Date',
          type: CustomTableColumnType.DATE,
          position: 0,
        },
        {
          tableId: 'table-2',
          key: 'amount',
          title: 'Amount',
          type: CustomTableColumnType.NUMBER,
          position: 1,
        },
        {
          tableId: 'table-2',
          key: 'counterparty',
          title: 'Counterparty',
          type: CustomTableColumnType.TEXT,
          position: 2,
        },
      ] as CustomTableColumn[]),
    } as any;

    const currentRows = [
      {
        id: 'row-1',
        tableId: 'table-1',
        rowNumber: 1,
        data: { date: '2026-03-10', amount: '-100', counterparty: 'Vendor A', currency: 'USD' },
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        updatedAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        id: 'row-1-kzt',
        tableId: 'table-1',
        rowNumber: 4,
        data: { date: '2026-03-10', amount: '-10', counterparty: 'Vendor A', currency: 'KZT' },
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        updatedAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        id: 'row-2',
        tableId: 'table-2',
        rowNumber: 1,
        data: { date: '2026-03-11', amount: '-50', counterparty: 'Vendor A' },
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        updatedAt: new Date('2026-03-11T00:00:00.000Z'),
      },
      {
        id: 'row-3',
        tableId: 'table-1',
        rowNumber: 2,
        data: { date: '2026-03-12', amount: '75', counterparty: 'Client B', currency: 'USD' },
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    ];

    const previousRows = [
      {
        id: 'row-prev-1',
        tableId: 'table-1',
        rowNumber: 3,
        data: { date: '2026-02-10', amount: '-20', counterparty: 'Vendor A', currency: 'USD' },
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
        updatedAt: new Date('2026-02-10T00:00:00.000Z'),
      },
    ];

    const qbCurrent = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(currentRows),
    };

    const qbPrevious = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(previousRows),
    };

    const customTableRowRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(qbCurrent)
        .mockReturnValueOnce(qbPrevious),
    } as any;

    const localService = new ReportsService(
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      customTableRepository,
      customTableColumnRepository,
      customTableRowRepository,
      createRepoMock(),
      { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as any,
      { createEvent: jest.fn() } as unknown as AuditService,
      createRepoMock(),
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );

    const result = await localService.getCustomTablesReport('workspace-1', {
      days: 30,
      flowType: 'all',
      sortBy: 'amount',
    } as any);

    expect(result.totals).toEqual({
      total: 235,
      manualTotal: 235,
      operations: 4,
    });
    expect(result.sourceSplit).toEqual({ manual: 235 });
    expect(result.aggregatedRows).toHaveLength(4);
    expect(result.aggregatedRows[0]).toMatchObject({
      counterparty: 'Vendor A',
      source: 'manual',
      total: 100,
      count: 1,
      tableId: 'table-1',
      tableName: 'Manual Table',
      currency: 'USD',
    });
    expect(result.aggregatedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          counterparty: 'Vendor A',
          source: 'manual',
          total: 10,
          currency: 'KZT',
        }),
      ]),
    );
    expect(result.timeseries).toEqual([
      { date: '2026-03-10', amount: 110 },
      { date: '2026-03-11', amount: 50 },
      { date: '2026-03-12', amount: 75 },
    ]);
  });

  it('returns drill-down items for a specific counterparty', async () => {
    const customTableRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'table-1',
          workspaceId: 'workspace-1',
          name: 'Manual Table',
          source: 'manual',
          category: null,
        },
      ]),
    } as any;

    const customTableColumnRepository = {
      find: jest.fn().mockResolvedValue([
        {
          tableId: 'table-1',
          key: 'date',
          title: 'Date',
          type: CustomTableColumnType.DATE,
          position: 0,
        },
        {
          tableId: 'table-1',
          key: 'amount',
          title: 'Amount',
          type: CustomTableColumnType.NUMBER,
          position: 1,
        },
        {
          tableId: 'table-1',
          key: 'counterparty',
          title: 'Counterparty',
          type: CustomTableColumnType.TEXT,
          position: 2,
        },
        {
          tableId: 'table-1',
          key: 'category',
          title: 'Category',
          type: CustomTableColumnType.TEXT,
          position: 3,
        },
      ] as CustomTableColumn[]),
    } as any;

    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'row-1',
          tableId: 'table-1',
          rowNumber: 1,
          data: {
            date: '2026-03-10',
            amount: '-100',
            counterparty: 'Vendor A',
            category: 'Ops',
          },
          createdAt: new Date('2026-03-10T00:00:00.000Z'),
          updatedAt: new Date('2026-03-10T00:00:00.000Z'),
        },
        {
          id: 'row-2',
          tableId: 'table-1',
          rowNumber: 2,
          data: {
            date: '2026-03-11',
            amount: '-50',
            counterparty: 'Vendor B',
            category: 'Marketing',
          },
          createdAt: new Date('2026-03-11T00:00:00.000Z'),
          updatedAt: new Date('2026-03-11T00:00:00.000Z'),
        },
      ]),
    };

    const customTableRowRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as any;

    const localService = new ReportsService(
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      customTableRepository,
      customTableColumnRepository,
      customTableRowRepository,
      createRepoMock(),
      { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as any,
      { createEvent: jest.fn() } as unknown as AuditService,
      createRepoMock(),
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );

    const result = await localService.getCustomTablesReportDrillDown('workspace-1', {
      counterparty: 'Vendor A',
      days: 30,
      flowType: 'expense',
    } as any);

    expect(result.counterparty).toBe('Vendor A');
    expect(result.items).toEqual([
      {
        rowId: 'row-1',
        tableId: 'table-1',
        tableName: 'Manual Table',
        source: 'manual',
        date: '2026-03-10',
        amount: 100,
        category: 'Ops',
        currency: null,
      },
    ]);
  });

  it('returns available tables with row counts', async () => {
    const customTableRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'table-1', workspaceId: 'workspace-1', name: 'Manual Table', source: 'manual' },
        {
          id: 'table-2',
          workspaceId: 'workspace-1',
          name: 'Second Table',
          source: 'manual',
        },
      ]),
    } as any;

    const customTableRowRepository = {
      count: jest
        .fn()
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7),
    } as any;

    const localService = new ReportsService(
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      customTableRepository,
      createRepoMock(),
      customTableRowRepository,
      createRepoMock(),
      { get: jest.fn(), set: jest.fn() } as any,
      { createEvent: jest.fn() } as unknown as AuditService,
      createRepoMock(),
      { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
      { getRate: jest.fn(async () => 1) } as any,
      { exportBalanceSheet: jest.fn() } as any,
    );

    const result = await localService.getAvailableCustomTables('workspace-1');

    expect(result).toEqual([
      { id: 'table-1', name: 'Manual Table', source: 'manual', rowCount: 3 },
      { id: 'table-2', name: 'Second Table', source: 'manual', rowCount: 7 },
    ]);
  });
});
