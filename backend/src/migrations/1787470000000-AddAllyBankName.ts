import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllyBankName1787470000000 implements MigrationInterface {
  name = 'AddAllyBankName1787470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'ally\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'ally' value will remain but is harmless if unused.
  }
}
