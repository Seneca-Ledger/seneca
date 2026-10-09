import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crypto lives on the wallet side only.
 *
 * Until now a coin could be two things at once: a wallet balance read off the
 * chain, and an investment holding typed in by hand. Net worth saw the second and
 * not the first, and anybody who kept both counted their coins twice. This moves
 * every crypto investment holding into a manual wallet — the same place the chain
 * balances live — and takes the class out of the investments table for good.
 *
 * The affected investment accounts' snapshots are scaled down by the share of the
 * account that moved out. That is exact when the account's holdings are priced in
 * one currency (the ordinary case) and close otherwise; refreshing prices rewrites
 * the snapshot exactly either way.
 */
export class MoveCryptoToWallets1786930000000 implements MigrationInterface {
  name = 'MoveCryptoToWallets1786930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "crypto_wallets"
        ADD COLUMN IF NOT EXISTS "kind" varchar(8) NOT NULL DEFAULT 'onchain'
    `);
    // A manual holding has no address to read.
    await queryRunner.query(`ALTER TABLE "crypto_wallets" ALTER COLUMN "address" DROP NOT NULL`);

    await queryRunner.query(`
      INSERT INTO "crypto_wallets" ("workspace_id", "address", "kind", "chain_id", "label", "balances")
      SELECT DISTINCT h."workspace_id", NULL, 'manual', 0, 'Manual holdings', '[]'::jsonb
        FROM "investment_holdings" h
       WHERE h."asset_class" = 'crypto'
         AND NOT EXISTS (
           SELECT 1 FROM "crypto_wallets" w
            WHERE w."workspace_id" = h."workspace_id" AND w."kind" = 'manual'
         )
    `);

    await queryRunner.query(`
      UPDATE "crypto_wallets" w
         SET "balances" = COALESCE(w."balances", '[]'::jsonb) || moved."balances"
        FROM (
          SELECT h."workspace_id",
                 jsonb_agg(jsonb_build_object(
                   'asset', upper(COALESCE(NULLIF(trim(h."symbol"), ''), h."name")),
                   'amount', trim(to_char(h."quantity", 'FM9999999999999990.999999999999999999')),
                   'costPerUnit', h."price"
                 )) AS "balances"
            FROM "investment_holdings" h
           WHERE h."asset_class" = 'crypto'
           GROUP BY h."workspace_id"
        ) moved
       WHERE w."workspace_id" = moved."workspace_id" AND w."kind" = 'manual'
    `);

    await queryRunner.query(`
      WITH totals AS (
        SELECT "account_id",
               SUM("quantity" * "price") AS total,
               SUM(CASE WHEN "asset_class" = 'crypto' THEN "quantity" * "price" ELSE 0 END) AS moved
          FROM "investment_holdings"
         GROUP BY "account_id"
      )
      UPDATE "balance_snapshots" s
         SET "amount" = ROUND(s."amount" * CASE WHEN t.total > 0 THEN (t.total - t.moved) / t.total ELSE 0 END, 2)
        FROM totals t
       WHERE s."account_id" = t."account_id" AND t.moved > 0
    `);

    await queryRunner.query(`DELETE FROM "investment_holdings" WHERE "asset_class" = 'crypto'`);

    // Postgres cannot drop one value of an enum; the type is rebuilt without it.
    await queryRunner.query(
      `ALTER TYPE "investment_asset_class_enum" RENAME TO "investment_asset_class_enum_old"`,
    );
    await queryRunner.query(`
      CREATE TYPE "investment_asset_class_enum" AS ENUM
        ('stock', 'etf', 'fund', 'bond', 'cash', 'real_estate', 'other')
    `);
    await queryRunner.query(
      `ALTER TABLE "investment_holdings" ALTER COLUMN "asset_class" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "investment_holdings"
        ALTER COLUMN "asset_class" TYPE "investment_asset_class_enum"
        USING "asset_class"::text::"investment_asset_class_enum"
    `);
    await queryRunner.query(
      `ALTER TABLE "investment_holdings" ALTER COLUMN "asset_class" SET DEFAULT 'other'`,
    );
    await queryRunner.query(`DROP TYPE "investment_asset_class_enum_old"`);
  }

  /**
   * Gives back the enum value and the schema. The holdings themselves stay where
   * they were moved: a wallet balance is the better home for them, and guessing
   * which account to put them back into would invent data.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "investment_asset_class_enum" ADD VALUE IF NOT EXISTS 'crypto'`,
    );
    await queryRunner.query(`DELETE FROM "crypto_wallets" WHERE "kind" = 'manual'`);
    await queryRunner.query(`ALTER TABLE "crypto_wallets" ALTER COLUMN "address" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "crypto_wallets" DROP COLUMN IF EXISTS "kind"`);
  }
}
