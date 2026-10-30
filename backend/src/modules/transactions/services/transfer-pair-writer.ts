import { randomUUID } from 'node:crypto';
import { In, IsNull, type Repository } from 'typeorm';
import {
  type Transaction,
  TransactionCategorySource,
  type TransferPairSource,
} from '../../../entities/transaction.entity';

/**
 * Writes the pairs. Each one only lands if both legs are still unpaired, so
 * two overlapping runs (an import and a manual detect) cannot cross-link rows.
 *
 * A leg that was only suggested "Transfers to people" (or any other kind)
 * loses the suggestion: money between the owner's own accounts is not a
 * payment to someone, and the import could not know that before pairing.
 */
export async function writeTransferPairs(
  transactions: Repository<Transaction>,
  pairs: Array<{ outgoing: { id: string }; incoming: { id: string } }>,
  source: TransferPairSource,
): Promise<number> {
  let applied = 0;
  for (const pair of pairs) {
    const transferPairId = randomUUID();
    const legs = [pair.outgoing.id, pair.incoming.id];
    const result = await transactions.update(
      { id: In(legs), transferPairId: IsNull() },
      { transferPairId, transferPairSource: source },
    );
    if (result.affected === 2) {
      applied += 1;
      await transactions.update(
        { id: In(legs), categorySource: TransactionCategorySource.KIND, isVerified: false },
        {
          categoryId: null,
          categorySource: TransactionCategorySource.DEFAULT,
          categoryReason: null,
        },
      );
      continue;
    }
    // Lost the race on one leg: a half-written pair would hide a single row.
    await transactions.update(
      { transferPairId },
      { transferPairId: null, transferPairSource: null },
    );
  }
  return applied;
}
