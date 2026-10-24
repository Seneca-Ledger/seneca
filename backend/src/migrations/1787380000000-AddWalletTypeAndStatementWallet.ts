import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accounts the user can see and manage: a wallet gets a type (checking, savings,
 * credit card…), and a statement gets the account it belongs to, which its rows
 * then follow.
 *
 * Existing statements are linked only where nothing is guessed: every row of the
 * statement already sits in one wallet and that wallet carries the statement's
 * own account number. Row wallets are left as they are; the Accounts page offers
 * the rest for linking instead of moving them behind the user's back.
 */
export class AddWalletTypeAndStatementWallet1787380000000 implements MigrationInterface {
  name = 'AddWalletTypeAndStatementWallet1787380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wallets"
      ADD COLUMN IF NOT EXISTS "type" VARCHAR(16) NOT NULL DEFAULT 'checking'
    `);
    await queryRunner.query(`
      ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "CHK_wallets_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "wallets" ADD CONSTRAINT "CHK_wallets_type"
      CHECK ("type" IN ('checking', 'cash', 'savings', 'deposit', 'brokerage', 'credit_card', 'loan'))
    `);

    await queryRunner.query(`
      ALTER TABLE "statements" ADD COLUMN IF NOT EXISTS "wallet_id" UUID
    `);
    await queryRunner.query(`
      ALTER TABLE "statements" DROP CONSTRAINT IF EXISTS "FK_statements_wallet"
    `);
    await queryRunner.query(`
      ALTER TABLE "statements" ADD CONSTRAINT "FK_statements_wallet"
      FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_statements_workspace_wallet"
      ON "statements" ("workspace_id", "wallet_id")
    `);

    await queryRunner.query(`
      UPDATE "statements" s
      SET "wallet_id" = only_wallet.wallet_id
      FROM (
        SELECT t.statement_id, MIN(t.wallet_id::text)::uuid AS wallet_id
        FROM "transactions" t
        WHERE t.statement_id IS NOT NULL
        GROUP BY t.statement_id
        HAVING COUNT(*) = COUNT(t.wallet_id) AND COUNT(DISTINCT t.wallet_id) = 1
      ) only_wallet
      JOIN "wallets" w ON w.id = only_wallet.wallet_id
      WHERE s.id = only_wallet.statement_id
        AND s.wallet_id IS NULL
        AND w.workspace_id = s.workspace_id
        AND COALESCE(w.account_number, '') <> ''
        AND REGEXP_REPLACE(UPPER(w.account_number), '[^0-9A-Z]', '', 'g')
          = REGEXP_REPLACE(UPPER(COALESCE(s.account_number, '')), '[^0-9A-Z]', '', 'g')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_statements_workspace_wallet"`);
    await queryRunner.query(`
      ALTER TABLE "statements" DROP CONSTRAINT IF EXISTS "FK_statements_wallet"
    `);
    await queryRunner.query(`ALTER TABLE "statements" DROP COLUMN IF EXISTS "wallet_id"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "CHK_wallets_type"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN IF EXISTS "type"`);
  }
}
