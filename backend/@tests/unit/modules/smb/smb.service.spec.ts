import { countedSql } from '@/common/utils/counted-transactions.util';
import { SmbService } from '../../../../src/modules/smb/smb.service';

function queryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['leftJoin', 'select', 'where', 'andWhere']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn(async () => []);
  return qb;
}

describe('SmbService bank rows', () => {
  it('reconciles bills against confirmed bank rows only', async () => {
    const qb = queryBuilder();
    const transactionRepository = { createQueryBuilder: jest.fn(() => qb) };
    const service = new SmbService(
      {} as never,
      transactionRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    // The rows the reconciliation and ageing views match bills against.
    await (service as unknown as { bankRows(id: string): Promise<unknown[]> }).bankRows('ws-1');

    expect(qb.andWhere).toHaveBeenCalledWith(countedSql('t'));
  });
});
