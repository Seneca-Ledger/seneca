import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrencyCustomTableColumnType1786140000000 implements MigrationInterface {
  name = 'AddCurrencyCustomTableColumnType1786140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "custom_table_column_type_enum" ADD VALUE IF NOT EXISTS \'currency\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не умеет удалять значения из enum. Значение 'currency'
    // останется, но без колонок этого типа оно безвредно.
  }
}
