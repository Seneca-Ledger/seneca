import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the Google Sheets integration: connected sheets and their OAuth
 * credentials, the Apps Script row mirror, the statement → sheet link, the
 * custom-table pull-sync settings and the Sheets import job queue.
 *
 * Custom tables imported from Sheets stay as ordinary tables: their source
 * becomes 'manual'. The 'google_sheets_import' value is left in
 * custom_table_source_enum on purpose — Postgres cannot drop an enum value
 * without rebuilding the type and rewriting every column that uses it, and a
 * value nothing writes any more costs nothing.
 *
 * down() only recreates the empty structures (matching the schema the earlier
 * migrations produced). The dropped rows, tokens and job history are gone.
 */
export class RemoveGoogleSheets1786640000000 implements MigrationInterface {
  name = 'RemoveGoogleSheets1786640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "custom_tables" SET "source" = 'manual' WHERE "source" = 'google_sheets_import'`,
    );

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_custom_tables_sync_enabled"');
    await queryRunner.query(`
      ALTER TABLE "custom_tables"
        DROP COLUMN IF EXISTS "sync_enabled",
        DROP COLUMN IF EXISTS "sync_interval_hours",
        DROP COLUMN IF EXISTS "sync_config",
        DROP COLUMN IF EXISTS "last_synced_at",
        DROP COLUMN IF EXISTS "last_sync_error"
    `);

    await queryRunner.query('DROP TABLE IF EXISTS "sheet_rows"');
    await queryRunner.query('DROP TABLE IF EXISTS "google_sheets_credentials"');

    await queryRunner.query(
      'ALTER TABLE "statements" DROP CONSTRAINT IF EXISTS "FK_1bc9fe2ea5c4161f0246494175f"',
    );
    await queryRunner.query('ALTER TABLE "statements" DROP COLUMN IF EXISTS "google_sheet_id"');

    await queryRunner.query('DROP TABLE IF EXISTS "google_sheets"');
    await queryRunner.query('DROP TABLE IF EXISTS "custom_table_import_jobs"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_table_import_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "progress" integer NOT NULL DEFAULT 0,
        "stage" character varying,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "result" jsonb,
        "error" text,
        "locked_at" TIMESTAMP,
        "locked_by" character varying,
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "workspace_id" uuid,
        CONSTRAINT "PK_e3f310f84da7fd7c14189e6e875" PRIMARY KEY ("id"),
        CONSTRAINT "FK_custom_table_import_jobs_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_custom_table_import_jobs_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_custom_table_import_jobs_user_id" ON "custom_table_import_jobs" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_custom_table_import_jobs_status" ON "custom_table_import_jobs" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_custom_table_import_jobs_created_at" ON "custom_table_import_jobs" ("created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_custom_table_import_jobs_workspace_id" ON "custom_table_import_jobs" ("workspace_id")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "google_sheets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "sheet_id" character varying NOT NULL,
        "sheet_name" character varying NOT NULL,
        "worksheet_name" character varying,
        "access_token" text NOT NULL,
        "refresh_token" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_sync" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "workspace_id" uuid NOT NULL,
        CONSTRAINT "PK_28176e989a4d29525d878f56dca" PRIMARY KEY ("id"),
        CONSTRAINT "FK_e84cd2b729fbf15635516497ccd"
          FOREIGN KEY ("user_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_google_sheets_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_google_sheets_workspace_id" ON "google_sheets" ("workspace_id")',
    );

    await queryRunner.query(
      'ALTER TABLE "statements" ADD COLUMN IF NOT EXISTS "google_sheet_id" uuid',
    );
    await queryRunner.query(`
      ALTER TABLE "statements"
        ADD CONSTRAINT "FK_1bc9fe2ea5c4161f0246494175f"
        FOREIGN KEY ("google_sheet_id") REFERENCES "google_sheets"("id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "google_sheets_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "workspace_id" uuid NOT NULL,
        "access_token" text NOT NULL,
        "refresh_token" text NOT NULL,
        "email" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_google_sheets_credentials_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_google_sheets_credentials_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_google_sheets_credentials_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_google_sheets_credentials_user_workspace"
      ON "google_sheets_credentials" ("user_id", "workspace_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sheet_rows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "google_sheet_id" uuid,
        "spreadsheet_id" character varying NOT NULL,
        "sheet_name" character varying NOT NULL,
        "row_number" integer NOT NULL,
        "col_b" text,
        "col_c" text,
        "col_f" text,
        "last_edited_at" TIMESTAMP,
        "edited_by" character varying,
        "edited_column" integer,
        "edited_cell" character varying,
        "last_event_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_6b2ac5a8b4c490bc8da8982ee2a" PRIMARY KEY ("id"),
        CONSTRAINT "FK_4a785dd92548b1f8e7b4c6b04cd"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_90174ca29e3da68019b99d7dd95"
          FOREIGN KEY ("google_sheet_id") REFERENCES "google_sheets"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sheet_rows_unique"
      ON "sheet_rows" ("spreadsheet_id", "sheet_name", "row_number")
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_sheet_rows_user" ON "sheet_rows" ("user_id")',
    );

    await queryRunner.query(`
      ALTER TABLE "custom_tables"
        ADD COLUMN IF NOT EXISTS "sync_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "sync_interval_hours" integer NOT NULL DEFAULT 24,
        ADD COLUMN IF NOT EXISTS "sync_config" jsonb,
        ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "last_sync_error" text
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_custom_tables_sync_enabled" ON "custom_tables" ("sync_enabled")',
    );
  }
}
