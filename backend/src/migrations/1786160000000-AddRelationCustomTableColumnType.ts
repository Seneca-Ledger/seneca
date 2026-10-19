import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelationCustomTableColumnType1786160000000 implements MigrationInterface {
  name = 'AddRelationCustomTableColumnType1786160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "custom_table_column_type_enum" ADD VALUE IF NOT EXISTS \'relation\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не умеет удалять значения из enum; без колонок этого типа
    // значение 'relation' безвредно.
  }
}
