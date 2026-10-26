import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tables filled from app data remember their source and filters, and every
 * filled row keeps the id of the record it came from. A refresh can then
 * update rows in place instead of inserting a second copy.
 */
export class AddCustomTableSourceBinding1786670000000 implements MigrationInterface {
  name = 'AddCustomTableSourceBinding1786670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_tables" ADD COLUMN IF NOT EXISTS "source_binding" jsonb NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_table_rows" ADD COLUMN IF NOT EXISTS "source_key" varchar NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_custom_table_rows_table_source_key" ON "custom_table_rows" ("table_id", "source_key") WHERE "source_key" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_table_rows_table_source_key"`);
    await queryRunner.query(`ALTER TABLE "custom_table_rows" DROP COLUMN IF EXISTS "source_key"`);
    await queryRunner.query(`ALTER TABLE "custom_tables" DROP COLUMN IF EXISTS "source_binding"`);
  }
}
