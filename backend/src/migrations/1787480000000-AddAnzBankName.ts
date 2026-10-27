import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnzBankName1787480000000 implements MigrationInterface {
  name = 'AddAnzBankName1787480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'anz\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'anz' value will remain but is harmless if unused.
  }
}
