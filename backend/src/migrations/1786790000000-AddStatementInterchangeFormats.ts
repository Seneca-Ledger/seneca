import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatementInterchangeFormats1786790000000 implements MigrationInterface {
  name = 'AddStatementInterchangeFormats1786790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['ofx', 'qif', 'camt', 'mt940']) {
      await queryRunner.query(`ALTER TYPE "file_type_enum" ADD VALUE IF NOT EXISTS '${value}'`);
    }
  }

  public async down(): Promise<void> {
    // Enum values cannot be removed in place; they stay, unused.
  }
}
