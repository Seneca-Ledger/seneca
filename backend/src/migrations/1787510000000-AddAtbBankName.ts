import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAtbBankName1787510000000 implements MigrationInterface {
  name = 'AddAtbBankName1787510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'atb\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'atb' value will remain but is harmless if unused.
  }
}
