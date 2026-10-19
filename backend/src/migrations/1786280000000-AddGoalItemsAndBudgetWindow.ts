import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives a goal a cost breakdown, and a budget a lifetime.
 *
 * Both exist for the same case: a goal with a horizon. A relocation is not one
 * number and not a limit that runs forever — it is a list of one-off costs due
 * in particular months, funded by budgets that start when the project starts
 * and stop when it ends.
 *
 * `goal_items` deliberately does not touch `goals.target_amount`. The declared
 * target stays the user's number; the lines explain it, and the gap between the
 * two is the signal worth showing.
 *
 * The unique key on budgets is replaced by two partial indexes. A plain key over
 * (workspace, category, period, goal_id) would not work: NULLs never collide in
 * Postgres, so every unattached duplicate the old constraint prevented would
 * quietly become legal again.
 */
export class AddGoalItemsAndBudgetWindow1786280000000 implements MigrationInterface {
  name = 'AddGoalItemsAndBudgetWindow1786280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "goal_items_status_enum" AS ENUM ('planned', 'paid');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "goal_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "goal_id" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "estimated_amount" numeric(15,2) NOT NULL,
        "actual_amount" numeric(15,2),
        "currency" character varying NOT NULL DEFAULT 'KZT',
        "due_month" character varying(7),
        "status" "goal_items_status_enum" NOT NULL DEFAULT 'planned',
        "note" text,
        "created_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_goal_items" PRIMARY KEY ("id")
      )
    `);

    // CASCADE from the goal, unlike budgets: a cost line has no meaning apart
    // from the goal it itemises, whereas a budget outlives the goal it served.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "goal_items"
          ADD CONSTRAINT "FK_goal_items_goal"
          FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "goal_items"
          ADD CONSTRAINT "FK_goal_items_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "goal_items"
          ADD CONSTRAINT "FK_goal_items_created_by"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // Every read is "the lines of this goal", tenant-scoped.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_goal_items_workspace_goal"
        ON "goal_items" ("workspace_id", "goal_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "budgets"
        ADD COLUMN IF NOT EXISTS "starts_on" date,
        ADD COLUMN IF NOT EXISTS "ends_on" date
    `);

    await queryRunner.query(`
      ALTER TABLE "budgets"
        DROP CONSTRAINT IF EXISTS "UQ_budgets_workspace_category_period"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_budgets_workspace_category_period_unlinked"
        ON "budgets" ("workspace_id", "category_id", "period_type")
        WHERE "goal_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_budgets_workspace_category_period_goal"
        ON "budgets" ("workspace_id", "category_id", "period_type", "goal_id")
        WHERE "goal_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_budgets_workspace_category_period_goal"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_budgets_workspace_category_period_unlinked"`);

    // Restoring the old constraint can fail if goal-scoped duplicates were
    // created while it was gone. That is deliberate: dropping those budgets to
    // force the constraint back on would destroy user data, so the rollback
    // stops and asks for a decision instead.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "budgets"
          ADD CONSTRAINT "UQ_budgets_workspace_category_period"
          UNIQUE ("workspace_id", "category_id", "period_type");
      EXCEPTION WHEN duplicate_table THEN NULL; END $$
    `);

    await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN IF EXISTS "ends_on"`);
    await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN IF EXISTS "starts_on"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_goal_items_workspace_goal"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goal_items"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "goal_items_status_enum"`);
  }
}
