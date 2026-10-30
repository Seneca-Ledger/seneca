import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBancoDoBrasilBankName1787530000000 implements MigrationInterface {
  name = 'AddBancoDoBrasilBankName1787530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'banco_do_brasil\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'banco_do_brasil' value will remain but is harmless if unused.
  }
}
