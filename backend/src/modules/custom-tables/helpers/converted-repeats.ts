import { In, type Repository } from 'typeorm';
import { generateTransactionFingerprint } from '../../../common/utils/fingerprint.util';
import type { Transaction } from '../../../entities/transaction.entity';

/** A table row converted to an expense: no account, so date, amount and merchant identify it. */
export function convertedRowFingerprint(
  workspaceId: string,
  row: { transactionDate: Date; amount: number; currency: string; merchant: string },
): string {
  return generateTransactionFingerprint({
    workspaceId,
    accountNumber: '',
    date: row.transactionDate,
    amount: row.amount,
    currency: row.currency,
    direction: 'debit',
    merchant: row.merchant,
  });
}

/**
 * Flags repeats the way statement parsing does: a draft whose fingerprint is
 * already in the workspace, or earlier in this batch, is still saved, but
 * `isDuplicate` keeps it out of the unique index `(workspace_id, fingerprint)
 * WHERE is_duplicate = false` and out of the totals. Answers a warning per
 * flagged row, `drafts[i]` being the transaction of `rows[i]`.
 */
export async function flagRepeatedRows(
  repository: Repository<Transaction>,
  workspaceId: string,
  drafts: Transaction[],
  rows: ReadonlyArray<{ rowNumber: number }>,
): Promise<string[]> {
  const fingerprints = [...new Set(drafts.map(draft => draft.fingerprint).filter(Boolean))];
  const existing = fingerprints.length
    ? await repository.find({
        where: { workspaceId, fingerprint: In(fingerprints), isDuplicate: false },
        select: { id: true, fingerprint: true },
      })
    : [];
  const owner = new Map(existing.map(row => [row.fingerprint, row.id]));
  const seen = new Set<string>();
  const warnings: string[] = [];

  drafts.forEach((draft, index) => {
    if (!draft.fingerprint) {
      return;
    }
    if (owner.has(draft.fingerprint) || seen.has(draft.fingerprint)) {
      draft.isDuplicate = true;
      draft.duplicateOfId = owner.get(draft.fingerprint) ?? null;
      warnings.push(`row ${rows[index].rowNumber} flagged as duplicate`);
      return;
    }
    seen.add(draft.fingerprint);
  });
  return warnings;
}
