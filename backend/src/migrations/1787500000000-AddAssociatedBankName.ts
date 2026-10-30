import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssociatedBankName1787500000000 implements MigrationInterface {
  name = 'AddAssociatedBankName1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'associated\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'associated' value will remain but is harmless if unused.
  }
}
