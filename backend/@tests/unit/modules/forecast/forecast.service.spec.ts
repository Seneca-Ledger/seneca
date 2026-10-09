import { ForecastService } from '../../../../src/modules/forecast/forecast.service';

/**
 * A query builder that keeps TypeORM's where semantics: `where()` replaces
 * every condition set before it, `andWhere()` adds one. A filter added before
 * `where()` is lost, exactly as in TypeORM.
 */
function recordingQuery(result: unknown) {
  const conditions: string[] = [];
  const query: any = {
    conditions,
    getRawMany: jest.fn(async () => result),
    getRawOne: jest.fn(async () => result),
  };
  for (const method of [
    'innerJoin',
    'select',
    'addSelect',
    'setParameters',
    'groupBy',
    'addGroupBy',
    'orderBy',
  ]) {
    query[method] = jest.fn(() => query);
  }
  query.where = jest.fn((sql: string) => {
    conditions.splice(0, conditions.length, sql);
    return query;
  });
  query.andWhere = jest.fn((sql: string) => {
    conditions.push(sql);
    return query;
  });
  return query;
}

describe('ForecastService history', () => {
  const build = () => {
    const queries: any[] = [];
    const transactionRepository = {
      createQueryBuilder: jest.fn(() => {
        const query = recordingQuery(queries.length === 1 ? { first: null } : []);
        queries.push(query);
        return query;
      }),
    };
    const service = new ForecastService(
      transactionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getRateOrNull: jest.fn(async () => 1) } as any,
    );
    return { service, queries };
  };

  it('averages income and expense over confirmed transactions only', async () => {
    const { service, queries } = build();

    await (service as any).monthlyHistory('ws-1', 'EUR', new Date('2026-10-04'));

    const [history, earliest] = queries;
    expect(history.conditions).toContain('t.isVerified = true');
    expect(history.conditions).toContain('s.workspaceId = :workspaceId');
    expect(earliest.conditions).toContain('t.isVerified = true');
  });

  it('learns recurring income from confirmed transactions only', async () => {
    const { service, queries } = build();

    await (service as any).incomeHistory('ws-1', new Date('2026-10-04'));

    expect(queries[0].conditions).toContain('t.isVerified = true');
    expect(queries[0].conditions).toContain('s.workspaceId = :workspaceId');
  });
});
