import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Importing a spreadsheet straight into payables, subscriptions, budgets,
 * invoices or transactions creates many records at once. This table remembers
 * what each run created or changed, so the whole run can be undone.
 */
export class AddImportBatches1786690000000 implements MigrationInterface {
  name = 'AddImportBatches1786690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "import_batches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "user_id" uuid NULL,
        "target" varchar(32) NOT NULL,
        "file_name" varchar(255) NULL,
        "created_refs" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "updated_refs" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "undone_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_batches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_import_batches_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_import_batches_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_import_batches_workspace_created" ON "import_batches" ("workspace_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "import_batches"`);
  }
}
