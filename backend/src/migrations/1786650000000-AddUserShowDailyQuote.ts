import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a user switch off the daily-quote banner. Defaults to on, so nobody's
 * screen changes until they opt out.
 */
export class AddUserShowDailyQuote1786650000000 implements MigrationInterface {
  name = 'AddUserShowDailyQuote1786650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "show_daily_quote" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "show_daily_quote"
    `);
  }
}
