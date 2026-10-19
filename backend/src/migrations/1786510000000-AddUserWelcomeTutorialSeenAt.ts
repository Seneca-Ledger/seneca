import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the user closed the welcome tutorial. NULL opens it after sign-up, so
 * accounts that already finished onboarding are backfilled: the tutorial is
 * for new accounts only. Accounts still in onboarding stay NULL — they are new.
 */
export class AddUserWelcomeTutorialSeenAt1786510000000 implements MigrationInterface {
  name = 'AddUserWelcomeTutorialSeenAt1786510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "welcome_tutorial_seen_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "welcome_tutorial_seen_at" = NOW()
      WHERE "welcome_tutorial_seen_at" IS NULL
        AND "onboarding_completed_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "welcome_tutorial_seen_at"
    `);
  }
}
