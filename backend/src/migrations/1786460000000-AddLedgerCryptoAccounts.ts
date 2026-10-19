import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crypto transactions enter the ledger, each crypto wallet on its own asset
 * account, like a cash wallet.
 *
 * The rows were skipped until now, and a skipped row is cleared like a booked
 * one, so they are queued again here; the sync worker books them on its next
 * run.
 */
export class AddLedgerCryptoAccounts1786460000000 implements MigrationInterface {
  name = 'AddLedgerCryptoAccounts1786460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ledger_accounts" ADD COLUMN IF NOT EXISTS "crypto_wallet_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "ledger_accounts" DROP CONSTRAINT IF EXISTS "FK_ledger_accounts_crypto_wallet"
    `);
    await queryRunner.query(`
      ALTER TABLE "ledger_accounts" ADD CONSTRAINT "FK_ledger_accounts_crypto_wallet"
        FOREIGN KEY ("crypto_wallet_id") REFERENCES "crypto_wallets"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_accounts_crypto_wallet"
        ON "ledger_accounts" ("crypto_wallet_id")
        WHERE "crypto_wallet_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "transactions"
         SET "ledger_dirty" = true, "ledger_error" = NULL, "ledger_attempted_at" = NULL
       WHERE "crypto_wallet_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ledger_accounts_crypto_wallet"`);
    await queryRunner.query(`
      ALTER TABLE "ledger_accounts" DROP CONSTRAINT IF EXISTS "FK_ledger_accounts_crypto_wallet"
    `);
    await queryRunner.query(
      `ALTER TABLE "ledger_accounts" DROP COLUMN IF EXISTS "crypto_wallet_id"`,
    );
  }
}
