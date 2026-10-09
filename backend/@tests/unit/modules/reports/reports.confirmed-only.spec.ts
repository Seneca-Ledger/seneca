import { IsNull } from 'typeorm';
import { AuditService } from '@/modules/audit/audit.service';
import { ReportsService } from '@/modules/reports/reports.service';

/**
 * What a report counts: confirmed rows that are not suspected duplicates, not
 * transfers between the user's own accounts and not on a trashed statement.
 * Every query a report method builds over transactions carries all four.
 */

const CONFIRMED = 'transaction.isVerified = true';
const COUNTABLE: Array<[string, (sql: string) => boolean]> = [
  ['confirmed', sql => sql === CONFIRMED],
  ['not a duplicate', sql => sql === 'transaction.isDuplicate = false'],
  ['not a transfer', sql => sql === 'transaction.transferPairId IS NULL'],
  ['not on a trashed statement', sql => /deleted_at IS NOT NULL/.test(sql)],
];

function recordingQueryBuilder() {
  const wheres: string[] = [];
  const qb: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return undefined;
        }
        if (prop === 'where' || prop === 'andWhere') {
          return (sql: unknown) => {
            if (typeof sql === 'string') {
              wheres.push(sql);
            }
            return qb;
          };
        }
        if (prop === 'getMany' || prop === 'getRawMany') {
          return async () => [];
        }
        if (prop === 'getRawOne' || prop === 'getOne') {
          return async () => undefined;
        }
        return () => qb;
      },
    },
  );
  return { qb, wheres };
}

function emptyRepo() {
  return {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    count: jest.fn(async () => 0),
  };
}

function buildService() {
  const { qb, wheres } = recordingQueryBuilder();
  const transactionRepository = { ...emptyRepo(), createQueryBuilder: jest.fn(() => qb) };
  const service = new ReportsService(
    transactionRepository as any,
    emptyRepo() as any,
    emptyRepo() as any,
    emptyRepo() as any,
    emptyRepo() as any,
    emptyRepo() as any,
    emptyRepo() as any,
    emptyRepo() as any,
    { get: jest.fn(async () => undefined), set: jest.fn(async () => undefined) } as any,
    { createEvent: jest.fn() } as unknown as AuditService,
    emptyRepo() as any,
    { findOne: jest.fn(async () => ({ currency: 'EUR' })) } as any,
    { getRate: jest.fn(async () => 1) } as any,
    { exportBalanceSheet: jest.fn() } as any,
  );
  const conditionsPerQuery = () => {
    const built = transactionRepository.createQueryBuilder.mock.calls.length;
    const counts = Object.fromEntries(
      COUNTABLE.map(([name, matches]) => [name, wheres.filter(matches).length]),
    );
    return { built, counts };
  };
  return { service, transactionRepository, conditionsPerQuery };
}

describe('ReportsService counts only what a report should', () => {
  const cases: Array<[string, (service: ReportsService) => Promise<unknown>]> = [
    ['daily report', service => service.generateDailyReport('ws-1', '2026-09-01')],
    ['monthly report', service => service.generateMonthlyReport('ws-1', 2026, 9)],
    ['latest transaction date', service => service.getLatestTransactionDate('ws-1')],
    [
      'custom report',
      service =>
        service.generateCustomReport('ws-1', { dateFrom: '2026-09-01', dateTo: '2026-09-30' } as any),
    ],
    ['statements summary', service => service.getStatementsSummary('ws-1', 30)],
    ['top categories', service => service.getTopCategoriesReport('ws-1', {} as any)],
    [
      'spend over time',
      service =>
        service.getSpendOverTimeReport('ws-1', {
          dateFrom: '2026-09-01',
          dateTo: '2026-09-03',
        } as any),
    ],
  ];

  it.each(cases)('%s filters every query it builds', async (_name, run) => {
    const { service, conditionsPerQuery } = buildService();

    await run(service);

    const { built, counts } = conditionsPerQuery();
    expect(built).toBeGreaterThan(0);
    expect(counts).toEqual(Object.fromEntries(COUNTABLE.map(([name]) => [name, built])));
  });

  it('template reports load confirmed rows only', async () => {
    const { service, transactionRepository } = buildService();
    jest.spyOn(service as any, 'buildRateMap').mockResolvedValue(new Map());

    await (service as any).loadReportRows('ws-1', {
      templateId: 'pnl',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });

    // Two alternatives: rows without a statement, and rows whose statement is not trashed.
    const where = transactionRepository.find.mock.calls[0][0].where;
    expect(where).toHaveLength(2);
    for (const branch of where) {
      expect(branch).toMatchObject({ isVerified: true, workspaceId: 'ws-1', isDuplicate: false });
      expect(branch.transferPairId).toEqual(IsNull());
    }
    expect(where[0].statementId).toEqual(IsNull());
    expect(where[1].statement).toEqual({ deletedAt: IsNull() });
  });
});
