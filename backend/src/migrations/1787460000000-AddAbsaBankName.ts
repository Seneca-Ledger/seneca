import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAbsaBankName1787460000000 implements MigrationInterface {
  name = 'AddAbsaBankName1787460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'absa\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'absa' value will remain but is harmless if unused.
  }
}
