import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Formula values used to be computed on every read, so nothing could filter,
 * sort or aggregate by them and no formula could look at another row. They are
 * now written here by the recalc pass after every change to the table.
 */
export class AddCustomTableRowComputed1786680000000 implements MigrationInterface {
  name = 'AddCustomTableRowComputed1786680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_table_rows" ADD COLUMN IF NOT EXISTS "computed" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "custom_table_rows" DROP COLUMN IF EXISTS "computed"`);
  }
}
