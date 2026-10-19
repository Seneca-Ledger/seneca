import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvestments1786750000000 implements MigrationInterface {
  name = 'AddInvestments1786750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "balance_accounts"
      ADD COLUMN IF NOT EXISTS "account_kind" character varying(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD COLUMN IF NOT EXISTS "investment_account_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
        ADD CONSTRAINT "FK_transactions_investment_account"
        FOREIGN KEY ("investment_account_id") REFERENCES "balance_accounts"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_investment_account"
      ON "transactions" ("investment_account_id") WHERE "investment_account_id" IS NOT NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "investment_asset_class_enum" AS ENUM
          ('stock', 'etf', 'fund', 'bond', 'crypto', 'cash', 'real_estate', 'other');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "investment_price_source_enum" AS ENUM ('manual', 'auto');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investment_holdings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "symbol" character varying(32),
        "name" character varying(255) NOT NULL,
        "asset_class" "investment_asset_class_enum" NOT NULL DEFAULT 'other',
        "quantity" numeric(24,8) NOT NULL DEFAULT 0,
        "price" numeric(20,6) NOT NULL DEFAULT 0,
        "price_currency" character varying(10) NOT NULL DEFAULT 'USD',
        "price_source" "investment_price_source_enum" NOT NULL DEFAULT 'manual',
        "priced_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_investment_holdings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_investment_holdings_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_investment_holdings_account"
          FOREIGN KEY ("account_id") REFERENCES "balance_accounts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_holdings_workspace_account"
      ON "investment_holdings" ("workspace_id", "account_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_holdings"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "investment_price_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "investment_asset_class_enum"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_investment_account"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_investment_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "investment_account_id"`,
    );
    await queryRunner.query(`ALTER TABLE "balance_accounts" DROP COLUMN IF EXISTS "account_kind"`);
  }
}
