import { countedSql } from '@/common/utils/counted-transactions.util';
import { InvestmentsService } from '../../../../src/modules/investments/investments.service';

function queryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn(async () => []);
  return qb;
}

describe('InvestmentsService contributions', () => {
  it('counts only confirmed contributions as paid in', async () => {
    const qb = queryBuilder();
    const transactionRepository = { createQueryBuilder: jest.fn(() => qb) };
    const service = new InvestmentsService(
      {} as never,
      {} as never,
      transactionRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await (
      service as unknown as {
        contributedByAccount(ws: string, ids: string[], currency: string): Promise<unknown>;
      }
    ).contributedByAccount('ws-1', ['account-1'], 'EUR');

    expect(qb.andWhere).toHaveBeenCalledWith(countedSql('t'));
  });
});
