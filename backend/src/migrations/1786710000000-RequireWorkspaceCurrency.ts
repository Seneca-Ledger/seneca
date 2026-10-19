import type { MigrationInterface, QueryRunner } from 'typeorm';
import { appDefaultCurrency } from '../common/utils/currency.util';

/**
 * Makes the workspace's own currency the only source of truth.
 *
 * Twelve tables carried a `'KZT'` column default, which is how a workspace that
 * never chose a currency ended up with tenge on its transactions, budgets and
 * invoices. The defaults go, `workspaces.currency` becomes required, and the
 * rows that have no currency are backfilled from `DEFAULT_CURRENCY` (USD when
 * unset) — set that variable before running this if the installation works in
 * something else.
 */
const CURRENCY_DEFAULT_TABLES = [
  'balance_snapshots',
  'budgets',
  'clients',
  'data_entries',
  'goal_items',
  'goals',
  'invoices',
  'payables',
  'statements',
  'subscriptions',
  'transactions',
  'wallets',
] as const;

export class RequireWorkspaceCurrency1786710000000 implements MigrationInterface {
  name = 'RequireWorkspaceCurrency1786710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A stored 'usd' is a currency that was typed in lower case, not a missing
    // one: normalise first so the backfill below only touches real gaps.
    await queryRunner.query(
      `UPDATE "workspaces" SET "currency" = upper(btrim("currency"))
        WHERE "currency" IS NOT NULL AND "currency" <> upper(btrim("currency"))`,
    );
    await queryRunner.query(
      `UPDATE "workspaces" SET "currency" = $1
        WHERE "currency" IS NULL OR "currency" !~ '^[A-Z]{3}$'`,
      [appDefaultCurrency()],
    );
    await queryRunner.query(`ALTER TABLE "workspaces" ALTER COLUMN "currency" SET NOT NULL`);

    for (const table of CURRENCY_DEFAULT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "currency" DROP DEFAULT`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of CURRENCY_DEFAULT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "currency" SET DEFAULT 'KZT'`);
    }
    await queryRunner.query(`ALTER TABLE "workspaces" ALTER COLUMN "currency" DROP NOT NULL`);
  }
}
