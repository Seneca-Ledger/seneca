import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Subscriptions 2.0: a tap counter for cost per use, a link to the savings
 * goal that sets money aside for the next big charge, and a notification
 * preference of its own for "looks like a subscription" prompts.
 */
export class AddSubscriptionUsageAndSinkingFund1786730000000 implements MigrationInterface {
  name = 'AddSubscriptionUsageAndSinkingFund1786730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD COLUMN IF NOT EXISTS "usage_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "usage_since" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "last_used_at" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "sinking_goal_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD CONSTRAINT "FK_subscriptions_sinking_goal"
        FOREIGN KEY ("sinking_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_preferences"
        ADD COLUMN IF NOT EXISTS "subscription_prompts" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" DROP COLUMN IF EXISTS "subscription_prompts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "FK_subscriptions_sinking_goal"`,
    );
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        DROP COLUMN IF EXISTS "sinking_goal_id",
        DROP COLUMN IF EXISTS "last_used_at",
        DROP COLUMN IF EXISTS "usage_since",
        DROP COLUMN IF EXISTS "usage_count"
    `);
  }
}
