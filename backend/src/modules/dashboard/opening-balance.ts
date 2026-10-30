import type { Repository } from 'typeorm';
import { countedSql } from '../../common/utils/counted-transactions.util';
import type { Transaction } from '../../entities/transaction.entity';
import { SPENDABLE_WALLET_TYPES } from '../../entities/wallet.entity';

type CurrencyBalance = { currency: string; balance: string };

/** Each row's amount converted (one after another) and added up. */
export async function sumConverted(
  rows: CurrencyBalance[],
  convert: (amount: string, currency: string) => Promise<number>,
): Promise<number> {
  let total = 0;
  for (const row of rows) {
    total += await convert(row.balance, row.currency);
  }
  return total;
}

/**
 * The money there is today. With accounts, what the everyday ones hold minus
 * what the cards owe (savings and deposits are not for spending), plus the
 * latest closing balance of each bank no account holds yet. Without any
 * account, the all-time net of every approved row, as before accounts.
 */
export async function spendableBalance(
  transactionRepo: Repository<Transaction>,
  workspaceId: string,
  {
    convert,
    allTime,
  }: {
    convert: (amount: string, currency: string) => Promise<number>;
    allTime: () => Promise<number>;
  },
): Promise<number> {
  const [{ count }] = await transactionRepo.query(
    'SELECT COUNT(*)::int AS count FROM wallets WHERE workspace_id = $1 AND is_active',
    [workspaceId],
  );
  if (count === 0) {
    return allTime();
  }

  const rows: CurrencyBalance[] = await transactionRepo.query(
    `SELECT w.currency, SUM(w.initial_balance + COALESCE(moved.net, 0)) AS balance
     FROM wallets w
     LEFT JOIN (
       SELECT t.wallet_id, SUM(COALESCE(t.credit, 0) - COALESCE(t.debit, 0)) AS net
         FROM transactions t
        WHERE t.workspace_id = $1 AND ${countedSql('t')}
        GROUP BY t.wallet_id
     ) moved ON moved.wallet_id = w.id
    WHERE w.workspace_id = $1 AND w.is_active AND w.type = ANY($2)
    GROUP BY w.currency
   UNION ALL
   SELECT latest.currency, latest.balance_end AS balance
     FROM (
       SELECT DISTINCT ON (s.bank_name, s.account_number, s.currency) s.currency, s.balance_end
         FROM statements s
        WHERE s.workspace_id = $1 AND s.deleted_at IS NULL AND s.balance_end IS NOT NULL
          AND s.status IN ('parsed', 'validated', 'completed') AND s.wallet_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM transactions held
             WHERE held.statement_id = s.id AND held.wallet_id IS NOT NULL
          )
        ORDER BY s.bank_name, s.account_number, s.currency,
          COALESCE(s.statement_date_to, s.created_at::date) DESC, s.created_at DESC
     ) latest`,
    [workspaceId, [...SPENDABLE_WALLET_TYPES]],
  );
  return Math.round((await sumConverted(rows, convert)) * 100) / 100;
}
