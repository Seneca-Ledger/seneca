import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits an on-chain row into "the value that moved" and "the fee that moved it",
 * and stops a synced transfer from waiting in Review.
 *
 * - `crypto_leg` joins the idempotency key, so a swap's fee can sit next to the
 *   swap's own leg of the same asset and direction without one overwriting the other.
 *   Existing rows are backfilled to `value`: a NULL would make Postgres treat every
 *   re-sync as a new row.
 * - `crypto_fee_amount` / `crypto_fee_asset` / `crypto_fee_fiat` carry the fee folded
 *   onto a transfer, in coin and in money, so cost basis can take it back out of the
 *   transfer's own value.
 * - Already-synced crypto rows are confirmed. The chain is the source of truth for
 *   them: there is nothing for a person to correct except the category, and leaving
 *   hundreds of them unconfirmed kept every crypto figure at zero.
 */
export class AddCryptoLegAndFee1786920000000 implements MigrationInterface {
  name = 'AddCryptoLegAndFee1786920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "crypto_leg"        varchar(8),
        ADD COLUMN IF NOT EXISTS "crypto_fee_amount" numeric(38,18),
        ADD COLUMN IF NOT EXISTS "crypto_fee_asset"  varchar(20),
        ADD COLUMN IF NOT EXISTS "crypto_fee_fiat"   numeric(15,2)
    `);

    await queryRunner.query(`
      UPDATE "transactions" SET "crypto_leg" = 'value'
      WHERE "crypto_tx_hash" IS NOT NULL AND "crypto_leg" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_crypto_tx"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_transactions_crypto_tx"
        ON "transactions"
        ("workspace_id", "crypto_wallet_id", "crypto_tx_hash", "crypto_asset", "transaction_type", "crypto_leg")
        WHERE "crypto_tx_hash" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "transactions" SET "is_verified" = true
      WHERE "crypto_wallet_id" IS NOT NULL AND "is_verified" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_crypto_tx"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_transactions_crypto_tx"
        ON "transactions"
        ("workspace_id", "crypto_wallet_id", "crypto_tx_hash", "crypto_asset", "transaction_type")
        WHERE "crypto_tx_hash" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP COLUMN IF EXISTS "crypto_leg",
        DROP COLUMN IF EXISTS "crypto_fee_amount",
        DROP COLUMN IF EXISTS "crypto_fee_asset",
        DROP COLUMN IF EXISTS "crypto_fee_fiat"
    `);
  }
}
