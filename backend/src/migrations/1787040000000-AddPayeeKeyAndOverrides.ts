import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categorisation moves to the payee model: a normalised payee key on every
 * transaction, a standing instruction per payee, and no more `category_learning`.
 *
 * `category_learning` held one row per corrected descriptor with a confidence
 * score; the payee's own confirmed transactions say the same thing without a
 * second store that could drift from them. Its data is not migrated on purpose
 * — the transactions it was derived from are still there, and they are now the
 * source of truth.
 *
 * `payee_key` is left NULL on existing rows (no backfill, per the same decision
 * as the confirmed-only rollout): history fills in as rows are re-classified
 * and as new ones arrive.
 */
export class AddPayeeKeyAndOverrides1787040000000 implements MigrationInterface {
  name = 'AddPayeeKeyAndOverrides1787040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payee_key" text`);
    // The only read is "this workspace, this payee, newest first".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_workspace_payee"
         ON "transactions" ("workspace_id", "payee_key", "transaction_date" DESC)
         WHERE "payee_key" IS NOT NULL`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payee_overrides_mode_enum" AS ENUM ('auto', 'always', 'never');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payee_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "payee_key" text NOT NULL,
        "display_name" text,
        "mode" "payee_overrides_mode_enum" NOT NULL DEFAULT 'auto',
        "category_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payee_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payee_overrides_workspace_key" UNIQUE ("workspace_id", "payee_key"),
        CONSTRAINT "FK_payee_overrides_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payee_overrides_category" FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payee_overrides_workspace" ON "payee_overrides" ("workspace_id")`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "category_learning"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The learned patterns themselves are not restorable; the table comes back
    // empty, which is what an install that never used it looks like.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "category_learning" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "workspace_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "payment_purpose" text NOT NULL,
        "counterparty_name" text,
        "learned_from" character varying NOT NULL DEFAULT 'manual_correction',
        "confidence" numeric(3,2) NOT NULL DEFAULT 1.0,
        "occurrences" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_category_learning" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payee_overrides_workspace"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payee_overrides"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payee_overrides_mode_enum"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_workspace_payee"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "payee_key"`);
  }
}
