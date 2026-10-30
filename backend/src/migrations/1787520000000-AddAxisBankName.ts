import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAxisBankName1787520000000 implements MigrationInterface {
  name = 'AddAxisBankName1787520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'axis\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'axis' value will remain but is harmless if unused.
  }
}
