import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The budget a subscription is paid from: its payments take that budget's
 * category. Optional; deleting the budget unlinks it. A new column only, no data.
 */
export class SubscriptionBudget1787370000000 implements MigrationInterface {
  name = 'SubscriptionBudget1787370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD "budget_id" uuid NULL`);
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_budget" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_workspace_budget" ON "subscriptions" ("workspace_id", "budget_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_subscriptions_workspace_budget"`);
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_budget"`,
    );
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "budget_id"`);
  }
}
