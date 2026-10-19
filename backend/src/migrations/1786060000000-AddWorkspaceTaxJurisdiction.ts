import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 of the tax jurisdiction engine: bind a workspace to a jurisdiction
 * and make its rate set versioned in time.
 *
 * Every new column carries a default that describes what existing rows already
 * are, so no backfill statement is needed:
 *  - `code`/`jurisdiction_id` stay NULL — pre-existing rates were typed by hand
 *    and have no statutory lineage.
 *  - `valid_from` gets the '1900-01-01' sentinel, so they resolve on any date
 *    exactly as they did before versioning existed.
 *  - `is_inclusive` is true because every amount in the system today comes from
 *    a bank statement or a receipt, and those are gross.
 */
export class AddWorkspaceTaxJurisdiction1786060000000 implements MigrationInterface {
  name = 'AddWorkspaceTaxJurisdiction1786060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        ADD COLUMN IF NOT EXISTS "tax_jurisdiction_id" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "workspaces"
          ADD CONSTRAINT "FK_workspaces_tax_jurisdiction"
          FOREIGN KEY ("tax_jurisdiction_id") REFERENCES "tax_jurisdictions"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "tax_rates"
        ADD COLUMN IF NOT EXISTS "jurisdiction_id"   uuid,
        ADD COLUMN IF NOT EXISTS "code"              character varying(40),
        ADD COLUMN IF NOT EXISTS "kind"              character varying(20) NOT NULL DEFAULT 'standard',
        ADD COLUMN IF NOT EXISTS "valid_from"        date NOT NULL DEFAULT '1900-01-01',
        ADD COLUMN IF NOT EXISTS "valid_to"          date,
        ADD COLUMN IF NOT EXISTS "is_inclusive"      boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "is_reverse_charge" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tax_rates"
          ADD CONSTRAINT "FK_tax_rates_jurisdiction"
          FOREIGN KEY ("jurisdiction_id") REFERENCES "tax_jurisdictions"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // A rate code may have many versions, but only one per start date. Partial
    // so that hand-made rates, which all have code NULL, do not collide.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_rates_workspace_code_version"
        ON "tax_rates" ("workspace_id", "code", "valid_from")
        WHERE "code" IS NOT NULL
    `);

    // Supports resolving "which rate applied on this transaction's date".
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tax_rates_validity"
        ON "tax_rates" ("workspace_id", "valid_from", "valid_to")
    `);

    // A closed period must not end before it begins. Cheap insurance against a
    // bug in the adoption logic silently producing unresolvable rows.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tax_rates"
          ADD CONSTRAINT "CHK_tax_rates_period"
          CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from");
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tax_rates" DROP CONSTRAINT IF EXISTS "CHK_tax_rates_period"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_rates_validity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tax_rates_workspace_code_version"`);
    await queryRunner.query(
      `ALTER TABLE "tax_rates" DROP CONSTRAINT IF EXISTS "FK_tax_rates_jurisdiction"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tax_rates"
        DROP COLUMN IF EXISTS "is_reverse_charge",
        DROP COLUMN IF EXISTS "is_inclusive",
        DROP COLUMN IF EXISTS "valid_to",
        DROP COLUMN IF EXISTS "valid_from",
        DROP COLUMN IF EXISTS "kind",
        DROP COLUMN IF EXISTS "code",
        DROP COLUMN IF EXISTS "jurisdiction_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "FK_workspaces_tax_jurisdiction"`,
    );
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "tax_jurisdiction_id"`);
  }
}
