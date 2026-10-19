import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomTableSync1786180000000 implements MigrationInterface {
  name = 'AddCustomTableSync1786180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "custom_tables"
        ADD COLUMN IF NOT EXISTS "sync_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "sync_interval_hours" integer NOT NULL DEFAULT 24,
        ADD COLUMN IF NOT EXISTS "sync_config" jsonb,
        ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "last_sync_error" text
    `);
    // Планировщик выбирает таблицы по этому признаку — без индекса он будет
    // сканировать всю таблицу на каждом тике.
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_custom_tables_sync_enabled" ON "custom_tables" ("sync_enabled")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_custom_tables_sync_enabled"');
    await queryRunner.query(`
      ALTER TABLE "custom_tables"
        DROP COLUMN IF EXISTS "sync_enabled",
        DROP COLUMN IF EXISTS "sync_interval_hours",
        DROP COLUMN IF EXISTS "sync_config",
        DROP COLUMN IF EXISTS "last_synced_at",
        DROP COLUMN IF EXISTS "last_sync_error"
    `);
  }
}
