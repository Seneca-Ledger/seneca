import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomTableExportSchedules1786190000000 implements MigrationInterface {
  name = 'CreateCustomTableExportSchedules1786190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_table_export_schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "table_id" uuid NOT NULL,
        "workspace_id" uuid NOT NULL,
        "created_by" uuid,
        "format" character varying(10) NOT NULL DEFAULT 'xlsx',
        "delivery" character varying(20) NOT NULL DEFAULT 'storage',
        "view_config" jsonb,
        "interval_hours" integer NOT NULL DEFAULT 168,
        "enabled" boolean NOT NULL DEFAULT true,
        "last_run_at" TIMESTAMP,
        "last_error" text,
        "last_file_path" text,
        "last_file_name" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_table_export_schedules" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_export_schedules"
      ADD CONSTRAINT "FK_cte_schedules_table"
      FOREIGN KEY ("table_id") REFERENCES "custom_tables"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_export_schedules"
      ADD CONSTRAINT "FK_cte_schedules_workspace"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_export_schedules"
      ADD CONSTRAINT "FK_cte_schedules_user"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_custom_table_export_schedules_enabled" ON "custom_table_export_schedules" ("enabled")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_custom_table_export_schedules_enabled"');
    await queryRunner.query('DROP TABLE IF EXISTS "custom_table_export_schedules"');
  }
}
