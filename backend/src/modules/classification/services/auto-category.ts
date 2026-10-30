import type { Repository } from 'typeorm';
import { payeeKeyOf } from '../../../common/utils/payee-key.util';
import type { PayeeAlias } from '../../../entities/payee-alias.entity';
import type { Transaction } from '../../../entities/transaction.entity';

// The steps after a user's rule, in the order autoClassifyCategory runs them.
export { suggestCategory } from '../suggestions/suggest-category';

/** The row's payee, or for a row not booked yet the one its descriptor is an alias of. */
export async function payeeIdOf(
  aliases: Repository<PayeeAlias>,
  transaction: Transaction,
  workspaceId: string,
): Promise<string | null> {
  if (transaction.payeeId) {
    return transaction.payeeId;
  }
  const payeeKey = payeeKeyOf(transaction);
  const alias = payeeKey ? await aliases.findOne({ where: { workspaceId, payeeKey } }) : null;
  return alias?.payeeId ?? null;
}

/** Newest first per payee, the most recent `depth` of the decided rows (also newest first). */
export function newestHistoryByPayee(
  evidence: ReadonlyArray<Pick<Transaction, 'payeeId' | 'categoryId'>>,
  depth: number,
): Map<string, Array<{ categoryId: string }>> {
  const historyOf = new Map<string, Array<{ categoryId: string }>>();
  for (const row of evidence) {
    const history = historyOf.get(row.payeeId as string) ?? [];
    if (history.length < depth) {
      history.push({ categoryId: row.categoryId as string });
    }
    historyOf.set(row.payeeId as string, history);
  }
  return historyOf;
}
