import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the person closed an insight. Closing means "not now": the insight stays
 * away for a week, or until the number it counts grows (InsightsService). Rows
 * dismissed before this column take their last update as the moment.
 */
export class AddInsightDismissedAt1787320000000 implements MigrationInterface {
  name = 'AddInsightDismissedAt1787320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "insights"
      ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      UPDATE "insights"
      SET "dismissed_at" = "updated_at"
      WHERE "is_dismissed" = true AND "dismissed_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "insights"
      DROP COLUMN IF EXISTS "dismissed_at"
    `);
  }
}
