import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gmail, Google Drive and Dropbox are gone: the app talks to no Google or
 * Dropbox service any more.
 *
 * - Receipts imported from Gmail are deleted, like a user deleting them: the
 *   transactions created on approve stay, notes on them go (FK cascade).
 *   Their attachment files on disk are not touched by a migration.
 * - The three integrations are deleted with their tokens and settings
 *   (FK cascade), then the settings tables and Gmail's queued jobs.
 * - `receipts.gmail_message_id` is the IMAP import's message key too, so it
 *   is renamed to `message_id`; `gmail_thread_id` only ever held Gmail data.
 * - 'gmail' leaves `receipts_source_enum` (default becomes 'upload') and the
 *   long-dead 'google_sheets_import' leaves `custom_table_source_enum`.
 * - `users.google_id` from the removed Google sign-in is dropped.
 *
 * Data loss is intended and cannot be undone: down() restores the structure
 * the earlier migrations left, empty. Take a database backup first if the
 * Gmail receipts are needed.
 */
export class RemoveGoogleAndDropbox1787340000000 implements MigrationInterface {
  name = 'RemoveGoogleAndDropbox1787340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "receipt_processing_jobs"
      WHERE "payload"->>'integrationId' IN (
        SELECT "id"::text FROM "integrations" WHERE "provider" = 'gmail'
      )
    `);
    await queryRunner.query(`DELETE FROM "receipts" WHERE "source" = 'gmail'`);
    await queryRunner.query(
      `DELETE FROM "integrations" WHERE "provider" IN ('gmail', 'google_drive', 'dropbox')`,
    );

    await queryRunner.query('DROP TABLE IF EXISTS "gmail_watch_subscriptions"');
    await queryRunner.query('DROP TYPE IF EXISTS "gmail_watch_subscription_status_enum"');
    await queryRunner.query('DROP TABLE IF EXISTS "gmail_settings"');
    await queryRunner.query('DROP TABLE IF EXISTS "drive_settings"');
    await queryRunner.query('DROP TABLE IF EXISTS "dropbox_settings"');

    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_receipts_workspace_gmail_message_id_unique"',
    );
    await queryRunner.query('ALTER TABLE "receipts" DROP COLUMN "gmail_thread_id"');
    await queryRunner.query(
      'ALTER TABLE "receipts" RENAME COLUMN "gmail_message_id" TO "message_id"',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_receipts_workspace_message_id_unique"
      ON "receipts" ("workspace_id", "message_id")
      WHERE "message_id" IS NOT NULL
    `);

    await this.replaceEnum(
      queryRunner,
      'receipts',
      'source',
      'receipts_source_enum',
      ['upload', 'telegram', 'scan', 'imap', 'peppol'],
      'upload',
    );
    await this.replaceEnum(
      queryRunner,
      'custom_tables',
      'source',
      'custom_table_source_enum',
      ['manual'],
      'manual',
    );

    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "google_id"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD COLUMN "google_id" character varying');

    await this.replaceEnum(
      queryRunner,
      'custom_tables',
      'source',
      'custom_table_source_enum',
      ['manual', 'google_sheets_import'],
      'manual',
    );
    await this.replaceEnum(
      queryRunner,
      'receipts',
      'source',
      'receipts_source_enum',
      ['gmail', 'upload', 'telegram', 'scan', 'imap', 'peppol'],
      'gmail',
    );

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_receipts_workspace_message_id_unique"');
    await queryRunner.query(
      'ALTER TABLE "receipts" RENAME COLUMN "message_id" TO "gmail_message_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "receipts" ADD COLUMN "gmail_thread_id" character varying',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_receipts_workspace_gmail_message_id_unique"
      ON "receipts" ("workspace_id", "gmail_message_id")
      WHERE "gmail_message_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "dropbox_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "integration_id" uuid NOT NULL,
        "folder_id" character varying,
        "folder_name" character varying,
        "sync_enabled" boolean NOT NULL DEFAULT true,
        "sync_time" character varying(5) NOT NULL DEFAULT '03:00',
        "time_zone" character varying(64),
        "last_sync_at" timestamp without time zone,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        CONSTRAINT "dropbox_settings_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "dropbox_settings_integration_id_key" UNIQUE ("integration_id"),
        CONSTRAINT "FK_dropbox_settings_integration" FOREIGN KEY ("integration_id")
          REFERENCES "integrations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_dropbox_settings_integration_id" ON "dropbox_settings" ("integration_id")',
    );
    await queryRunner.query(`
      CREATE TABLE "drive_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "integration_id" uuid NOT NULL,
        "folder_id" character varying,
        "folder_name" character varying,
        "sync_enabled" boolean NOT NULL DEFAULT true,
        "sync_time" character varying(5) NOT NULL DEFAULT '03:00',
        "time_zone" character varying(64),
        "last_sync_at" timestamp without time zone,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        CONSTRAINT "drive_settings_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "drive_settings_integration_id_key" UNIQUE ("integration_id"),
        CONSTRAINT "FK_drive_settings_integration" FOREIGN KEY ("integration_id")
          REFERENCES "integrations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "gmail_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "integration_id" uuid NOT NULL,
        "label_id" character varying,
        "label_name" character varying NOT NULL,
        "filter_enabled" boolean NOT NULL DEFAULT true,
        "filter_config" jsonb,
        "watch_enabled" boolean NOT NULL DEFAULT false,
        "watch_expiration" timestamp without time zone,
        "last_sync_at" timestamp without time zone,
        "history_id" character varying,
        CONSTRAINT "PK_gmail_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_gmail_settings_integration_id" UNIQUE ("integration_id"),
        CONSTRAINT "FK_gmail_settings_integration" FOREIGN KEY ("integration_id")
          REFERENCES "integrations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE TYPE "gmail_watch_subscription_status_enum" AS ENUM ('active', 'expired', 'error')`,
    );
    await queryRunner.query(`
      CREATE TABLE "gmail_watch_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "integration_id" uuid NOT NULL,
        "topic_name" character varying NOT NULL,
        "subscription_name" character varying NOT NULL,
        "expiration" timestamp without time zone NOT NULL,
        "history_id" character varying,
        "status" "gmail_watch_subscription_status_enum" NOT NULL DEFAULT 'active',
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "email_address" character varying,
        CONSTRAINT "PK_gmail_watch_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gmail_watch_subscriptions_integration" FOREIGN KEY ("integration_id")
          REFERENCES "integrations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_gmail_watch_subscription_email" ON "gmail_watch_subscriptions" ("email_address")',
    );
  }

  /** Postgres can't drop an enum label: swap the column onto a fresh type. */
  private async replaceEnum(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    typeName: string,
    labels: string[],
    defaultLabel: string,
  ): Promise<void> {
    const list = labels.map(label => `'${label}'`).join(', ');
    await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "${typeName}" RENAME TO "${typeName}_old"`);
    await queryRunner.query(`CREATE TYPE "${typeName}" AS ENUM (${list})`);
    await queryRunner.query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE "${typeName}" USING "${column}"::text::"${typeName}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT '${defaultLabel}'`,
    );
    await queryRunner.query(`DROP TYPE "${typeName}_old"`);
  }
}
