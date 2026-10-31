import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBarclaysBankName1787660000000 implements MigrationInterface {
  name = 'AddBarclaysBankName1787660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'barclays\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'barclays' value will remain but is harmless if unused.
  }
}
