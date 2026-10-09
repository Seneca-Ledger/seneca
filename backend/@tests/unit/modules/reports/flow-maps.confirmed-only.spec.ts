import { CashFlowMapService } from '@/modules/reports/cash-flow-map.service';
import { SpendFlowService } from '@/modules/reports/spend-flow.service';

/**
 * The cash-flow map and the spend-flow Sankey sum confirmed transactions only:
 * every query they build carries the confirmed filter.
 */

function recordingRepository() {
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
        return () => qb;
      },
    },
  );
  const repository = { createQueryBuilder: jest.fn(() => qb) };
  const confirmedPerQuery = () => ({
    built: repository.createQueryBuilder.mock.calls.length,
    confirmed: wheres.filter(sql => sql === 't.isVerified = true').length,
  });
  return { repository, confirmedPerQuery };
}

const categories = { find: jest.fn(async () => []) };
const workspaces = { findOne: jest.fn(async () => ({ currency: 'EUR' })) };
const rates = { getRate: jest.fn(async () => 1), getRateOrNull: jest.fn(async () => 1) };

describe('flow maps count only confirmed transactions', () => {
  it('cash-flow map, including the comparison period', async () => {
    const { repository, confirmedPerQuery } = recordingRepository();
    const service = new CashFlowMapService(
      repository as any,
      categories as any,
      workspaces as any,
      rates as any,
    );

    await service.getMap('ws-1', { dateFrom: '2026-09-01', dateTo: '2026-09-30', compare: true });

    const { built, confirmed } = confirmedPerQuery();
    expect(built).toBe(2);
    expect(confirmed).toBe(built);
  });

  it('spend flow', async () => {
    const { repository, confirmedPerQuery } = recordingRepository();
    const service = new SpendFlowService(
      repository as any,
      categories as any,
      workspaces as any,
      rates as any,
    );

    await service.getSpendFlow('ws-1', { dateFrom: '2026-09-01', dateTo: '2026-09-30' } as any);

    const { built, confirmed } = confirmedPerQuery();
    expect(built).toBeGreaterThan(0);
    expect(confirmed).toBe(built);
  });
});
