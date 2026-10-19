import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiCustomTableColumnType1786210000000 implements MigrationInterface {
  name = 'AddAiCustomTableColumnType1786210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "custom_table_column_type_enum" ADD VALUE IF NOT EXISTS \'ai\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не умеет удалять значения из enum; без колонок этого типа
    // значение 'ai' безвредно.
  }
}
