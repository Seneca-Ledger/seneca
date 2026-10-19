import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 of the tax jurisdiction engine: remembering which threshold alert
 * has already gone out.
 *
 * Two columns rather than two booleans. The level records how far the alert
 * has escalated, and the window records which measuring period it belongs to,
 * so a new year resets the alerts by itself instead of needing a nightly job
 * to clear flags.
 */
export class AddTaxThresholdAlerts1786120000000 implements MigrationInterface {
  name = 'AddTaxThresholdAlerts1786120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        ADD COLUMN IF NOT EXISTS "tax_threshold_alert_level"  integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tax_threshold_alert_window" character varying(16)
    `);

    // 0 = nothing sent, 80 and 100 = the two escalation points.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "workspaces"
          ADD CONSTRAINT "CHK_workspaces_tax_threshold_level"
          CHECK ("tax_threshold_alert_level" IN (0, 80, 100));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "CHK_workspaces_tax_threshold_level"`,
    );
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        DROP COLUMN IF EXISTS "tax_threshold_alert_window",
        DROP COLUMN IF EXISTS "tax_threshold_alert_level"
    `);
  }
}
