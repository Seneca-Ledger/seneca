import type { Repository } from 'typeorm';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import type { PayeeDuplicateGroups } from '../../contracts';
import type { Payee } from '../../entities/payee.entity';
import { Transaction } from '../../entities/transaction.entity';
import { groupLikelyDuplicates } from './payee-duplicates';

/** Groups of the workspace's payees that look like one business, each with how many rows the viewer sees. */
export async function likelyDuplicateGroups(
  payeeRepository: Repository<Payee>,
  workspaceId: string,
  viewerMemberId: string | null,
): Promise<PayeeDuplicateGroups> {
  const payees: Array<{ id: string; name: string; count: string }> = await payeeRepository
    .createQueryBuilder('payee')
    .leftJoin(
      Transaction,
      'transaction',
      `transaction.payeeId = payee.id AND transaction.workspaceId = payee.workspaceId AND ${readablePrivateSql('transaction')}`,
      { [PRIVACY_VIEWER_PARAM]: viewerMemberId },
    )
    .select('payee.id', 'id')
    .addSelect('payee.name', 'name')
    .addSelect('COUNT(transaction.id)', 'count')
    .where('payee.workspaceId = :workspaceId', { workspaceId })
    .groupBy('payee.id')
    .getRawMany();
  return groupLikelyDuplicates(
    payees.map(payee => ({ id: payee.id, name: payee.name, count: Number(payee.count) })),
  ).map(group => ({ payees: group.sort((a, b) => b.count - a.count) }));
}
