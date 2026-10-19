import type { MigrationInterface, QueryRunner } from 'typeorm';

const UUID_RE = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/**
 * Three integrity gaps found by the entity-graph audit:
 *
 * 1. category_learning had no FK on category_id/user_id — deleted categories
 *    kept feeding the classifier as suggestions.
 * 2. receipt_processing_jobs had no workspace_id and no FKs at all.
 * 3. custom_table_import_jobs had no workspace_id; worse, the google_sheets
 *    flow stored the WORKSPACE id in user_id (and looked jobs up by it).
 *    Real user ids for those rows are recovered from payload.importUserId.
 *
 * Job rows are transient progress records, so rows that cannot be attributed
 * to an existing user are deleted rather than kept unconstrained.
 */
export class AddJobScopingAndLearningFks1786250000000 implements MigrationInterface {
  name = 'AddJobScopingAndLearningFks1786250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── category_learning ────────────────────────────────────────────────
    // Таблицу не создавала НИ ОДНА миграция (все трогавшие её защищались
    // hasTable) — на свежей базе обучение категорий падало при первой записи.
    const hasLearning = await queryRunner.hasTable('category_learning');
    if (!hasLearning) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "category_learning_learned_from_enum"
          AS ENUM ('manual_correction', 'bulk_assignment', 'auto_confirmed', 'ai_classification');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      await queryRunner.query(`
        CREATE TABLE "category_learning" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "user_id" uuid NOT NULL,
          "workspace_id" uuid NOT NULL,
          "category_id" uuid NOT NULL,
          "payment_purpose" text NOT NULL,
          "counterparty_name" text,
          "learned_from" "category_learning_learned_from_enum" NOT NULL DEFAULT 'manual_correction',
          "confidence" numeric(3,2) NOT NULL DEFAULT 1.0,
          "occurrences" integer NOT NULL DEFAULT 1,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "FK_category_learning_workspace"
            FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_category_learning_workspace_category"
        ON "category_learning" ("workspace_id", "category_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_category_learning_user_category"
        ON "category_learning" ("user_id", "category_id")
      `);
    } else {
      await queryRunner.query(`
        DELETE FROM "category_learning" cl
        WHERE NOT EXISTS (SELECT 1 FROM "categories" c WHERE c."id" = cl."category_id")
           OR NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = cl."user_id")
      `);
    }
    await queryRunner.query(`
      ALTER TABLE "category_learning"
      ADD CONSTRAINT "FK_category_learning_category"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "category_learning"
      ADD CONSTRAINT "FK_category_learning_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // ── receipt_processing_jobs ──────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "receipt_processing_jobs" ADD COLUMN "workspace_id" uuid`);
    await queryRunner.query(`
      UPDATE "receipt_processing_jobs" j
      SET "workspace_id" = r."workspace_id"
      FROM "receipts" r
      WHERE j."receipt_id" = r."id" AND j."workspace_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "receipt_processing_jobs" j
      SET "workspace_id" = i."workspace_id"
      FROM "integrations" i
      WHERE j."workspace_id" IS NULL
        AND j."payload"->>'integrationId' ~ '${UUID_RE}'
        AND (j."payload"->>'integrationId')::uuid = i."id"
    `);
    await queryRunner.query(`
      DELETE FROM "receipt_processing_jobs" j
      WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = j."user_id")
    `);
    await queryRunner.query(`
      UPDATE "receipt_processing_jobs" j
      SET "receipt_id" = NULL
      WHERE j."receipt_id" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "receipts" r WHERE r."id" = j."receipt_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "receipt_processing_jobs"
      ADD CONSTRAINT "FK_receipt_processing_jobs_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "receipt_processing_jobs"
      ADD CONSTRAINT "FK_receipt_processing_jobs_workspace"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "receipt_processing_jobs"
      ADD CONSTRAINT "FK_receipt_processing_jobs_receipt"
      FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_receipt_processing_jobs_workspace_id"
      ON "receipt_processing_jobs" ("workspace_id")
    `);

    // ── custom_table_import_jobs ─────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "custom_table_import_jobs" ADD COLUMN "workspace_id" uuid`,
    );
    // Legacy google_sheets rows: user_id held the workspace id.
    await queryRunner.query(`
      UPDATE "custom_table_import_jobs" j
      SET "workspace_id" = j."user_id"
      WHERE j."type" = 'google_sheets'
        AND EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = j."user_id")
    `);
    await queryRunner.query(`
      UPDATE "custom_table_import_jobs" j
      SET "user_id" = (j."payload"->>'importUserId')::uuid
      WHERE j."type" = 'google_sheets'
        AND j."payload"->>'importUserId' ~ '${UUID_RE}'
        AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = (j."payload"->>'importUserId')::uuid)
    `);
    await queryRunner.query(`
      UPDATE "custom_table_import_jobs" j
      SET "workspace_id" = (j."payload"->>'workspaceId')::uuid
      WHERE j."workspace_id" IS NULL
        AND j."payload"->>'workspaceId' ~ '${UUID_RE}'
        AND EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = (j."payload"->>'workspaceId')::uuid)
    `);
    await queryRunner.query(`
      DELETE FROM "custom_table_import_jobs" j
      WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = j."user_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_import_jobs"
      ADD CONSTRAINT "FK_custom_table_import_jobs_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_import_jobs"
      ADD CONSTRAINT "FK_custom_table_import_jobs_workspace"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_table_import_jobs_workspace_id"
      ON "custom_table_import_jobs" ("workspace_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_table_import_jobs_workspace_id"`);
    await queryRunner.query(
      `ALTER TABLE "custom_table_import_jobs" DROP CONSTRAINT "FK_custom_table_import_jobs_workspace"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_table_import_jobs" DROP CONSTRAINT "FK_custom_table_import_jobs_user"`,
    );
    await queryRunner.query(`ALTER TABLE "custom_table_import_jobs" DROP COLUMN "workspace_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_receipt_processing_jobs_workspace_id"`);
    await queryRunner.query(
      `ALTER TABLE "receipt_processing_jobs" DROP CONSTRAINT "FK_receipt_processing_jobs_receipt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_processing_jobs" DROP CONSTRAINT "FK_receipt_processing_jobs_workspace"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_processing_jobs" DROP CONSTRAINT "FK_receipt_processing_jobs_user"`,
    );
    await queryRunner.query(`ALTER TABLE "receipt_processing_jobs" DROP COLUMN "workspace_id"`);

    await queryRunner.query(
      `ALTER TABLE "category_learning" DROP CONSTRAINT "FK_category_learning_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_learning" DROP CONSTRAINT "FK_category_learning_category"`,
    );
  }
}
