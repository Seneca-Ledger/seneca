import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Links a budget to the goal it serves.
 *
 * Until now a goal was a savings counter with no edge to spending, and a budget
 * knew its category but not what the limit was for. One nullable column closes
 * the graph into `Goal -> Budgets -> Categories -> Merchants`, which is what the
 * plan-versus-actual view reads.
 *
 * The column is nullable with no backfill: every budget that exists today is
 * genuinely unattached, and saying so is more honest than inventing a link.
 *
 * `ON DELETE SET NULL` rather than CASCADE — a goal is soft-deleted
 * (`goals.deleted_at`), so the constraint would not fire on the normal delete
 * path anyway, and losing a budget because its goal was archived would be
 * surprising. Consequently every read that resolves a budget's goal must still
 * filter `deleted_at IS NULL` itself.
 */
export class AddBudgetGoalLink1786260000000 implements MigrationInterface {
  name = 'AddBudgetGoalLink1786260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "budgets"
        ADD COLUMN IF NOT EXISTS "goal_id" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "budgets"
          ADD CONSTRAINT "FK_budgets_goal"
          FOREIGN KEY ("goal_id") REFERENCES "goals"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // Supports "every budget of this goal", the entry point of the flow query.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_budgets_workspace_goal"
        ON "budgets" ("workspace_id", "goal_id")
    `);

    // The flow aggregate filters on (workspace, category IN (...), date) over
    // non-duplicate rows. IDX_transactions_workspace_date_amount does not carry
    // the category, so without this the tree seq-scans the workspace.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_workspace_category_date"
        ON "transactions" ("workspace_id", "category_id", "transaction_date")
        WHERE "is_duplicate" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_workspace_category_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_budgets_workspace_goal"`);
    await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT IF EXISTS "FK_budgets_goal"`);
    await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN IF EXISTS "goal_id"`);
  }
}
