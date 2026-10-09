import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical precious metals as a holding: the `metal` asset class plus the lot's
 * own columns on `investment_holdings`. Nothing is backfilled — every existing
 * holding keeps a NULL metal and behaves exactly as before.
 */
export class AddPreciousMetals1786950000000 implements MigrationInterface {
  name = 'AddPreciousMetals1786950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "investment_asset_class_enum" ADD VALUE IF NOT EXISTS 'metal'`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "investment_metal_enum" AS ENUM ('XAU', 'XAG', 'XPT', 'XPD');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "metal_weight_unit_enum" AS ENUM ('g', 'ozt', 'kg');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "investment_holdings"
        ADD COLUMN IF NOT EXISTS "metal" "investment_metal_enum",
        ADD COLUMN IF NOT EXISTS "unit_weight" numeric(16,6),
        ADD COLUMN IF NOT EXISTS "weight_unit" "metal_weight_unit_enum",
        ADD COLUMN IF NOT EXISTS "purity" numeric(6,5),
        ADD COLUMN IF NOT EXISTS "acquired_on" date,
        ADD COLUMN IF NOT EXISTS "cost_total" numeric(20,6),
        ADD COLUMN IF NOT EXISTS "cost_currency" character varying(10),
        ADD COLUMN IF NOT EXISTS "counterparty" character varying(255)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_holdings_workspace_metal"
      ON "investment_holdings" ("workspace_id", "metal") WHERE "metal" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_investment_holdings_workspace_metal"`);
    await queryRunner.query(`
      ALTER TABLE "investment_holdings"
        DROP COLUMN IF EXISTS "counterparty",
        DROP COLUMN IF EXISTS "cost_currency",
        DROP COLUMN IF EXISTS "cost_total",
        DROP COLUMN IF EXISTS "acquired_on",
        DROP COLUMN IF EXISTS "purity",
        DROP COLUMN IF EXISTS "weight_unit",
        DROP COLUMN IF EXISTS "unit_weight",
        DROP COLUMN IF EXISTS "metal"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "metal_weight_unit_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "investment_metal_enum"`);
    // The 'metal' label stays on investment_asset_class_enum: Postgres cannot
    // drop one enum value, and rebuilding the type would rewrite the column for
    // a label that no row can hold once the metal columns are gone.
  }
}
