import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankOfScotlandBankName1787550000000 implements MigrationInterface {
  name = 'AddBankOfScotlandBankName1787550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'bank_of_scotland\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'bank_of_scotland' value will remain but is harmless if unused.
  }
}
